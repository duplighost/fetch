// world.js — scene container + declarative house compiler (uninvited engine port).
// Rooms/doors/stairs/colliders come from data tables; geometry merges per material.
// Blackthorn's documented glitches are fixed here by construction: camera 0.2/260,
// frame boxes overlap wall holes by 0.05, no ground plane under floor holes,
// contextlost handled in main, lighting floors never lowered.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, damp } from './util.js';

export const CS = 2;               // one cell = 2m
const WALL_T = 0.26;
const EXT_T = 0.4;
const DOOR_W = 1.3, DOOR_H = 2.25;
const WIN_W = 1.4;

export class World {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.colliders = [];             // {min:{x,y,z}, max:{x,y,z}, door?, skullPass?}
    this.doors = [];
    this.doorById = {};
    this.fetchTargets = [];          // {id, object?|pos, radius, enabled, onHit}
    this.interactables = [];         // meshes with userData.inter
    this.zones = [];                 // {name, min, max}
    this.ramps = [];
    this.rooms = [];                 // {id, level, x0,z0,x1,z1 (world), floorY}
    this.floorHoles = [];            // {level, x0,z0,x1,z1 (world)}
    this.candles = [];               // {x,y,z,intensity,r}
    this.terrainHeight = null;       // fn(x,z) set by outside builder
    this.postClamp = null;           // fn(pos, dt) set by forest builder
    this.surfaceZones = [];          // {min,max, surface}
    this._geo = new Map();           // material -> geometry list (merged at finish)

    this._buildCandlePool();
  }

  // ------------------------------------------------------------ primitives
  addCollider(x0, y0, z0, x1, y1, z1, flags) {
    const c = {
      min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) },
      max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) },
      ...flags,
    };
    this.colliders.push(c);
    return c;
  }

  box(mat, x, y, z, w, h, d, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    if (!this._geo.has(mat)) this._geo.set(mat, []);
    this._geo.get(mat).push(g);
  }

  finishStatic() {
    for (const [mat, list] of this._geo) {
      if (!list.length) continue;
      const merged = mergeGeometries(list);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      for (const g of list) g.dispose();
    }
    this._geo.clear();
  }

  addZone(name, x0, z0, x1, z1, yMin = -50, yMax = 50) {
    this.zones.push({ name, min: { x: x0, y: yMin, z: z0 }, max: { x: x1, y: yMax, z: z1 } });
  }

  zoneAt(pos) {
    for (const z of this.zones) {
      if (pos.x >= z.min.x && pos.x <= z.max.x &&
          pos.z >= z.min.z && pos.z <= z.max.z &&
          pos.y >= z.min.y && pos.y <= z.max.y) return z.name;
    }
    return null;
  }

  addSurface(surface, x0, z0, x1, z1, yMin = -50, yMax = 50) {
    this.surfaceZones.push({ surface, min: { x: x0, y: yMin, z: z0 }, max: { x: x1, y: yMax, z: z1 } });
  }

  surfaceAt(pos) {
    for (const s of this.surfaceZones) {
      if (pos.x >= s.min.x && pos.x <= s.max.x &&
          pos.z >= s.min.z && pos.z <= s.max.z &&
          pos.y >= s.min.y && pos.y <= s.max.y) return s.surface;
    }
    return 'dirt';
  }

  addFetchTarget(t) {
    t.enabled = t.enabled !== false;
    this.fetchTargets.push(t);
    return t;
  }

  registerInteract(obj, id, action) {
    // invisible hitbox for groups; the crosshair-growth is the only affordance
    let target = obj;
    if (!obj.isMesh) {
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.4, size.x + 0.15), Math.max(0.4, size.y + 0.15), Math.max(0.4, size.z + 0.15)),
        new THREE.MeshBasicMaterial({ visible: false }));
      box.getCenter(hit.position);
      this.scene.add(hit);
      target = hit;
    }
    target.userData.inter = { id, action, enabled: true };
    this.interactables.push(target);
    return target.userData.inter;
  }

  // ------------------------------------------------------- ground + levels
  groundHeightAt(x, z, curY) {
    let best = -Infinity;
    for (const r of this.ramps) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const t = r.axis === 'z' ? (z - r.z0) / (r.z1 - r.z0) : (x - r.x0) / (r.x1 - r.x0);
      const h = lerp(r.y0, r.y1, clamp(t, 0, 1));
      if (h <= curY + 0.55 && h > best) best = h;
    }
    for (const room of this.rooms) {
      if (x < room.x0 || x > room.x1 || z < room.z0 || z > room.z1) continue;
      let holed = false;
      for (const hle of this.floorHoles) {
        if (hle.level !== room.level) continue;
        if (x >= hle.x0 && x <= hle.x1 && z >= hle.z0 && z <= hle.z1) { holed = true; break; }
      }
      if (holed) continue;
      if (room.floorY <= curY + 0.55 && room.floorY > best) best = room.floorY;
    }
    if (best > -Infinity) return best;
    return this.terrainHeight ? this.terrainHeight(x, z) : 0;
  }

  // --------------------------------------------------------- house compiler
  // tables: { origin:[ox,oz], levels:{name:{floor,ceil}}, rooms, doors, windows,
  //           ramps, floorHoles, ceilHoles }
  buildHouse(T) {
    const [OX, OZ] = T.origin;
    const M = this.mats;
    const cellMaps = {};    // level -> Map "cx,cz" -> room
    const wx = (cx) => OX + cx * CS;
    const wz = (cz) => OZ + cz * CS;

    for (const lv of Object.keys(T.levels)) cellMaps[lv] = new Map();
    for (const [id, x0, z0, x1, z1, lv, opts] of T.rooms) {
      const room = { id, lv, x0, z0, x1, z1, opts: opts || {} };
      for (let cx = x0; cx <= x1; cx++)
        for (let cz = z0; cz <= z1; cz++)
          cellMaps[lv].set(cx + ',' + cz, room);
      this.rooms.push({
        id, level: lv, floorY: T.levels[lv].floor,
        x0: wx(x0), z0: wz(z0), x1: wx(x1 + 1), z1: wz(z1 + 1),
      });
    }
    for (const [lv, x0, z0, x1, z1] of (T.floorHoles || [])) {
      this.floorHoles.push({ level: lv, x0: wx(x0), z0: wz(z0), x1: wx(x1 + 1), z1: wz(z1 + 1) });
    }
    const ceilHoles = (T.ceilHoles || []).map(([lv, x0, z0, x1, z1]) =>
      ({ lv, x0: wx(x0), z0: wz(z0), x1: wx(x1 + 1), z1: wz(z1 + 1) }));

    // normalize door/window specs onto edges: H edge (cx,cz) between (cx,cz-1)/(cx,cz);
    // V edge (cx,cz) between (cx-1,cz)/(cx,cz)
    const edgeCuts = new Map();  // "lv|H|cx,cz" -> [{type, spec, center}]
    const edgeOf = (cx, cz, dir) => {
      if (dir === 'N') return ['H', cx, cz];
      if (dir === 'S') return ['H', cx, cz + 1];
      if (dir === 'W') return ['V', cx, cz];
      return ['V', cx + 1, cz];
    };
    const addCut = (lv, cx, cz, dir, cut) => {
      const [o, ex, ez] = edgeOf(cx, cz, dir);
      const key = lv + '|' + o + '|' + ex + ',' + ez;
      if (!edgeCuts.has(key)) edgeCuts.set(key, []);
      cut.orient = o; cut.ex = ex; cut.ez = ez;
      edgeCuts.get(key).push(cut);
    };
    for (const [lv, cx, cz, dir, opts] of (T.doors || []))
      addCut(lv, cx, cz, dir, { type: 'door', opts: opts || {} , lv, dir });
    for (const [lv, cx, cz, dir, opts] of (T.windows || []))
      addCut(lv, cx, cz, dir, { type: 'window', opts: opts || {}, lv, dir });

    // walls per edge; sides are canonical (A = lower-coordinate side)
    for (const lv of Object.keys(T.levels)) {
      const { floor, ceil } = T.levels[lv];
      const cells = cellMaps[lv];
      const seen = new Set();
      const visit = (o, ex, ez) => {
        const key = o + '|' + ex + ',' + ez;
        if (seen.has(key)) return;
        seen.add(key);
        const a = o === 'H' ? cells.get(ex + ',' + (ez - 1)) : cells.get((ex - 1) + ',' + ez);
        const b = cells.get(ex + ',' + ez);
        if (a === b || (a && b && a.id === b.id)) return;
        const exterior = !a || !b;
        const t = exterior ? EXT_T : WALL_T;
        const matOf = (room) => room ? (M[room.opts.wall || 'plaster'] || M.plaster) : M.woodDark;
        const cuts = edgeCuts.get(lv + '|' + key) || [];
        this._emitWall(o, ex, ez, floor, ceil, t, matOf(a), matOf(b), cuts, OX, OZ, lv, T);
      };
      for (const k of cells.keys()) {
        const [cx, cz] = k.split(',').map(Number);
        visit('H', cx, cz); visit('H', cx, cz + 1);
        visit('V', cx, cz); visit('V', cx + 1, cz);
      }
    }

    // floors + ceilings per room, with rect subtraction around holes
    for (const [id, x0, z0, x1, z1, lv, opts] of T.rooms) {
      const { floor, ceil } = T.levels[lv];
      const o = opts || {};
      const fx0 = wx(x0), fz0 = wz(z0), fx1 = wx(x1 + 1), fz1 = wz(z1 + 1);
      const fmat = M[o.floor || 'woodFloor'] || M.woodFloor;
      const cmat = M[o.ceil || 'ceiling'] || M.ceiling;
      const holesF = this.floorHoles.filter(h => h.level === lv &&
        !(h.x1 < fx0 || h.x0 > fx1 || h.z1 < fz0 || h.z0 > fz1));
      this._slabWithHoles(fmat, fx0, fz0, fx1, fz1, floor - 0.11, 0.22, holesF);
      if (!o.noCeil) {
        const holesC = ceilHoles.filter(h => h.lv === lv &&
          !(h.x1 < fx0 || h.x0 > fx1 || h.z1 < fz0 || h.z0 > fz1));
        this._slabWithHoles(cmat, fx0, fz0, fx1, fz1, ceil + 0.11, 0.22, holesC);
      }
    }

    // stairs
    for (const r of (T.ramps || [])) {
      const ramp = {
        x0: wx(r.x0), x1: wx(r.x1 + 1), z0: wz(r.z0), z1: wz(r.z1 + 1),
        axis: r.axis, y0: r.y0, y1: r.y1,
      };
      this.ramps.push(ramp);
      this._buildStairs(ramp, M[r.mat || 'woodDark'] || M.woodDark);
    }
  }

  _emitWall(orient, ex, ez, floor, ceil, t, matA, matB, cuts, OX, OZ, lv, T) {
    // wall runs one cell (CS) along its axis
    const H = orient === 'H';
    const ax0 = H ? OX + ex * CS : OZ + ez * CS;
    const ax1 = ax0 + CS;
    const fixed = H ? OZ + ez * CS : OX + ex * CS;
    const height = ceil - floor;

    // build cut intervals along the axis
    const iv = [];
    for (const c of cuts) {
      const isDoor = c.type === 'door';
      const w = c.opts.w || (isDoor ? DOOR_W : WIN_W);
      const mid = ax0 + CS / 2;
      const y0 = isDoor ? floor : floor + (c.opts.sill != null ? c.opts.sill : 1.0);
      const y1 = isDoor ? floor + (c.opts.h || DOOR_H) : floor + 2.6;
      iv.push({ a: mid - w / 2, b: mid + w / 2, y0, y1, cut: c });
    }
    iv.sort((p, q) => p.a - q.a);

    const emit = (a, b, y0, y1, solidBase) => {
      if (b - a < 0.02 || y1 - y0 < 0.02) return;
      const len = b - a, mid = (a + b) / 2, cy = (y0 + y1) / 2, h = y1 - y0;
      // two half-thickness slabs so each side wears its room's material
      if (H) {
        this.box(matA, mid, cy, fixed - t / 4, len, h, t / 2);
        this.box(matB, mid, cy, fixed + t / 4, len, h, t / 2);
      } else {
        this.box(matA, fixed - t / 4, cy, mid, t / 2, h, len);
        this.box(matB, fixed + t / 4, cy, mid, t / 2, h, len);
      }
      if (solidBase) {
        if (H) this.addCollider(a, y0, fixed - t / 2, b, y1, fixed + t / 2);
        else this.addCollider(fixed - t / 2, y0, a, fixed + t / 2, y1, b);
      }
    };

    let cursor = ax0;
    for (const c of iv) {
      emit(cursor, c.a, floor, ceil, true);
      // lintel above + sill below the opening
      emit(c.a, c.b, c.y1, ceil, false);
      emit(c.a, c.b, floor, c.y0, false);
      if (c.y0 > floor + 0.02) {
        // sill piece is climb-proof but real: give it a collider
        if (H) this.addCollider(c.a, floor, fixed - t / 2, c.b, c.y0, fixed + t / 2);
        else this.addCollider(fixed - t / 2, floor, c.a, fixed + t / 2, c.y0, c.b);
      }
      cursor = c.b;
      // spawn the actual door / window
      const mid = (c.a + c.b) / 2;
      if (c.cut.type === 'door') {
        this._spawnDoor(c.cut, H, mid, fixed, floor, c.y1 - floor, c.b - c.a, t);
      } else {
        this._spawnWindow(c.cut, H, mid, fixed, c.y0, c.y1, c.b - c.a, t);
      }
    }
    emit(cursor, ax1, floor, ceil, true);
  }

  _spawnWindow(cut, H, mid, fixed, y0, y1, w, t) {
    const M = this.mats;
    const open = cut.opts.open;   // the bedroom window: no glass, skull flies through
    // frame overlaps the wall opening by 0.05 so hole-edge faces are buried (z-fight fix)
    const fw = 0.1;
    const mk = (x, y, z, sx, sy, sz) => {
      if (H) this.box(M.woodDark, x, y, z, sx, sy, sz);
      else this.box(M.woodDark, z, y, x, sz, sy, sx);
    };
    mk(mid, y0 - 0.02, fixed, w + 0.1, fw, t + 0.06);
    mk(mid, y1 + 0.02, fixed, w + 0.1, fw, t + 0.06);
    mk(mid - w / 2 - 0.02, (y0 + y1) / 2, fixed, fw, y1 - y0 + 0.1, t + 0.06);
    mk(mid + w / 2 + 0.02, (y0 + y1) / 2, fixed, fw, y1 - y0 + 0.1, t + 0.06);
    if (!open) {
      // dark glass pane
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(w, y1 - y0),
        new THREE.MeshStandardMaterial({ color: 0x0a1016, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 }));
      if (H) { glass.position.set(mid, (y0 + y1) / 2, fixed); }
      else { glass.position.set(fixed, (y0 + y1) / 2, mid); glass.rotation.y = Math.PI / 2; }
      this.scene.add(glass);
    }
    // window hole blocks the player always; blocks the skull only when glazed
    const flags = open ? { skullPass: true } : undefined;
    if (H) this.addCollider(mid - w / 2, y0, fixed - t / 2, mid + w / 2, y1, fixed + t / 2, flags);
    else this.addCollider(fixed - t / 2, y0, mid - w / 2, fixed + t / 2, y1, mid + w / 2, flags);
  }

  _spawnDoor(cut, H, mid, fixed, floor, h, w, t) {
    const door = new Door(this, cut, H, mid, fixed, floor, h, w, t);
    this.doors.push(door);
    if (cut.opts.id) this.doorById[cut.opts.id] = door;
    return door;
  }

  _slabWithHoles(mat, x0, z0, x1, z1, cy, th, holes) {
    // rect subtraction: split into strips around each hole
    let rects = [{ x0, z0, x1, z1 }];
    for (const h of holes) {
      const next = [];
      for (const r of rects) {
        if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) { next.push(r); continue; }
        if (h.z0 > r.z0) next.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: h.z0 });
        if (h.z1 < r.z1) next.push({ x0: r.x0, z0: h.z1, x1: r.x1, z1: r.z1 });
        const zi0 = Math.max(r.z0, h.z0), zi1 = Math.min(r.z1, h.z1);
        if (h.x0 > r.x0) next.push({ x0: r.x0, z0: zi0, x1: h.x0, z1: zi1 });
        if (h.x1 < r.x1) next.push({ x0: h.x1, z0: zi0, x1: r.x1, z1: zi1 });
      }
      rects = next;
    }
    for (const r of rects) {
      if (r.x1 - r.x0 < 0.02 || r.z1 - r.z0 < 0.02) continue;
      this.box(mat, (r.x0 + r.x1) / 2, cy, (r.z0 + r.z1) / 2, r.x1 - r.x0, th, r.z1 - r.z0);
    }
  }

  _buildStairs(ramp, mat) {
    const rise = 0.185;
    const drop = ramp.y1 - ramp.y0;
    const steps = Math.max(2, Math.round(Math.abs(drop) / rise));
    const along = ramp.axis === 'z' ? ramp.z1 - ramp.z0 : ramp.x1 - ramp.x0;
    const stepLen = along / steps;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const y = lerp(ramp.y0, ramp.y1, (i + 1) / steps);
      const h = Math.abs(y - ramp.y0) + 0.12;
      const cy = Math.min(y, ramp.y0) + (ramp.y1 > ramp.y0 ? h / 2 : -h / 2 + (y - Math.min(y, ramp.y0)) + h / 2);
      const yCenter = (Math.min(ramp.y0, ramp.y1) - 0.12 + y) / 2;
      const yH = y - (Math.min(ramp.y0, ramp.y1) - 0.12);
      if (ramp.axis === 'z') {
        const z = ramp.z0 + stepLen * (i + 0.5);
        this.box(mat, (ramp.x0 + ramp.x1) / 2, yCenter, z, ramp.x1 - ramp.x0, yH, stepLen + 0.01);
      } else {
        const x = ramp.x0 + stepLen * (i + 0.5);
        this.box(mat, x, yCenter, (ramp.z0 + ramp.z1) / 2, stepLen + 0.01, yH, ramp.z1 - ramp.z0);
      }
    }
  }

  // -------------------------------------------------------------- lighting
  buildLights(scene) {
    // uninvited's floors — do not lower; 'the house feels empty' always meant lighting.
    // (r161 physical lighting: ambient/hemi carry the floor, point lights need candela-scale.)
    scene.add(new THREE.AmbientLight(0x46536e, 0.95));
    const hemi = new THREE.HemisphereLight(0x2c3852, 0x14100c, 0.75);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x8098c0, 1.3);
    moon.position.set(35, 60, -25);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -60; moon.shadow.camera.right = 60;
    moon.shadow.camera.top = 60; moon.shadow.camera.bottom = -60;
    moon.shadow.bias = -0.0004;
    scene.add(moon);
    this.moon = moon;
  }

  freezeMoonShadow(renderer, scene, camera) {
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    renderer.shadowMap.autoUpdate = false;   // static sun => free shadows
  }

  _buildCandlePool() {
    this.candlePool = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xff9540, 0, 9, 1.8);
      this.candlePool.push(l);
    }
    this._candleT = 0;
  }

  attachCandlePool(scene) {
    for (const l of this.candlePool) scene.add(l);
  }

  updateCandles(dt, playerPos, t) {
    this._candleT -= dt;
    if (this._candleT <= 0) {
      this._candleT = 0.4;
      const sorted = this.candles.slice().sort((a, b) =>
        ((a.x - playerPos.x) ** 2 + (a.z - playerPos.z) ** 2) -
        ((b.x - playerPos.x) ** 2 + (b.z - playerPos.z) ** 2));
      for (let i = 0; i < this.candlePool.length; i++) {
        const l = this.candlePool[i];
        const c = sorted[i];
        if (c) { l.position.set(c.x, c.y, c.z); l.userData.c = c; l.visible = true; }
        else { l.visible = false; l.userData.c = null; }
      }
    }
    for (const l of this.candlePool) {
      const c = l.userData.c;
      if (!c) continue;
      // ×35: physically-correct lighting wants candela-scale point intensities
      l.intensity = c.intensity * 35 *
        (0.82 + Math.sin(t * 11 + c.x * 7.7) * 0.09 + Math.sin(t * 23 + c.z * 13.3) * 0.06 + Math.random() * 0.05);
    }
  }

  update(dt) {
    for (const d of this.doors) d.update(dt);
  }
}

// ---------------------------------------------------------------- doors
export class Door {
  constructor(world, cut, H, mid, fixed, floor, h, w, t) {
    this.world = world;
    this.opts = cut.opts;
    this.id = cut.opts.id || null;
    this.locked = cut.opts.locked || null;   // key id, 'never', or 'boards'
    this.heavy = !!cut.opts.heavy;
    this.secret = !!cut.opts.secret;
    this.open = false;
    this.anim = 0;
    this.target = 0;
    this.h = h; this.w = w;
    this.floor = floor;
    this.unlockedOnce = false;

    const M = world.mats;
    const scene = world.scene;
    // hinge at the opening edge
    this.group = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.05, 0.09), M.woodDark);
    panel.position.set((w - 0.06) / 2, 0, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x5d5648, metalness: 0.85, roughness: 0.35 }));
    knob.position.set(w - 0.2, -0.05, 0.07);
    this.group.add(panel, knob);
    this.panel = panel;

    if (H) {
      this.group.position.set(mid - w / 2, floor + h / 2, fixed);
    } else {
      // hinge at the -z edge; local +x must span toward +z, so yaw is -90°
      this.group.position.set(fixed, floor + h / 2, mid - w / 2);
      this.group.rotation.y = -Math.PI / 2;
    }
    scene.add(this.group);

    // frame — overlap the wall hole by 0.05 (z-fight fix)
    const mkF = (x, y, z, sx, sy, sz) => {
      if (H) world.box(M.woodDark, x, y, z, sx, sy, sz);
      else world.box(M.woodDark, z, y, x, sz, sy, sx);
    };
    mkF(mid, floor + h + 0.03, fixed, w + 0.14, 0.12, t + 0.08);
    mkF(mid - w / 2 - 0.03, floor + h / 2, fixed, 0.1, h + 0.1, t + 0.08);
    mkF(mid + w / 2 + 0.03, floor + h / 2, fixed, 0.1, h + 0.1, t + 0.08);

    // collider collapses to zero height when open
    if (H) this.collider = world.addCollider(mid - w / 2, floor, fixed - 0.13, mid + w / 2, floor + h, fixed + 0.13, { door: this });
    else this.collider = world.addCollider(fixed - 0.13, floor, mid - w / 2, fixed + 0.13, floor + h, mid + w / 2, { door: this });
    this._closedMaxY = this.collider.max.y;

    world.registerInteract(panel, 'door:' + (this.id || Math.random().toString(36).slice(2)),
      (game) => this.tryUse(game));
  }

  setOpen(open) {
    this.open = open;
    this.target = open ? 1 : 0;
    this.collider.max.y = open ? this.collider.min.y : this._closedMaxY;
  }

  tryUse(game) {
    if (this.open) {
      this.setOpen(false);
      game.audio.doorClose({ pos: this.group.position });
      return;
    }
    if (this.locked === 'never' || this.locked === 'boards') {
      game.audio.lockedRattle({ pos: this.group.position });
      game.shake(0.12);
      return;
    }
    if (this.locked) {
      if (game.keys.has(this.locked)) {
        if (!this.unlockedOnce) {
          this.unlockedOnce = true;
          game.audio.unlock({ pos: this.group.position });
          this.locked = null;
          return;  // first use turns the key; second opens — earned
        }
      } else {
        game.audio.lockedRattle({ pos: this.group.position });
        return;
      }
    }
    this.setOpen(true);
    game.audio.doorOpen(this.heavy, { pos: this.group.position });
  }

  unlock(game) {
    if (!this.locked) return;
    this.locked = null;
    this.unlockedOnce = true;
    if (game) game.audio.unlock({ pos: this.group.position });
  }

  update(dt) {
    const speed = this.secret ? 0.5 : 2.4;
    const d = this.target - this.anim;
    if (Math.abs(d) > 0.001) {
      this.anim = clamp(this.anim + Math.sign(d) * speed * dt, 0, 1);
      const e = this.anim < 0.5 ? 2 * this.anim * this.anim : 1 - Math.pow(-2 * this.anim + 2, 2) / 2;
      if (this.secret) {
        this.group.position.y = this.floor + this.h / 2 - e * (this.h - 0.15);
      } else {
        this.group.rotation.y = (this.group.userData.baseRy ??= this.group.rotation.y) + e * 1.9;
      }
    }
  }
}

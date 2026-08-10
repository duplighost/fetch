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
    this.rampById = {};              // stable authored stair lookup for debug/regressions
    this.rooms = [];                 // {id, level, x0,z0,x1,z1 (world), floorY}
    this.floorHoles = [];            // {level, x0,z0,x1,z1 (world)}
    this.candles = [];               // {x,y,z,intensity,r}
    this.windowOpenings = [];        // physical apertures + world-space aim glints
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
    const zone = { name, enabled: true, min: { x: x0, y: yMin, z: z0 }, max: { x: x1, y: yMax, z: z1 } };
    this.zones.push(zone);
    return zone;
  }

  zoneAt(pos) {
    for (const z of this.zones) {
      if (z.enabled === false) continue;
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
    // Later zones are authored as local overrides of broad act-level beds.
    for (let i = this.surfaceZones.length - 1; i >= 0; i--) {
      const s = this.surfaceZones[i];
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
    // Terrain is another candidate layer only where there is no authored
    // above-ground storey. This matters when a basement extends beyond the
    // house footprint: someone walking over the pump gallery stays on the yard,
    // while someone already below resolves to its cellar floor. Inside the
    // house footprint, however, a floor hole is intentional architecture. Letting
    // terrain y=0 compete there pins the cellar ramp to ground level and makes
    // the canonical house -> basement descent impossible.
    const terrain = this.terrainHeight ? this.terrainHeight(x, z) : 0;
    const underSurfaceStorey = this.rooms.some((room) => room.level !== 'basement'
      && x >= room.x0 && x <= room.x1 && z >= room.z0 && z <= room.z1);
    if (!underSurfaceStorey && terrain <= curY + 0.55 && terrain > best) best = terrain;
    return best > -Infinity ? best : terrain;
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
        ...r,
        x0: wx(r.x0), x1: wx(r.x1 + 1), z0: wz(r.z0), z1: wz(r.z1 + 1),
        axis: r.axis, y0: r.y0, y1: r.y1,
      };
      this.ramps.push(ramp);
      if (ramp.id) this.rampById[ramp.id] = ramp;
      this._buildStairs(
        ramp,
        M[r.mat || 'woodDark'] || M.woodDark,
        M[r.guardMat || r.mat || 'woodDark'] || M.woodDark,
      );
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

    if (open) {
      // A thin line of reflected skull-light lives on the physical frame, not
      // in a HUD. It brightens only when the camera ray passes cleanly through
      // the aperture, so open windows can teach aiming by luminance and motion.
      const hw = w / 2, hh = (y1 - y0) / 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: 0xbecbd0, transparent: true, opacity: 0.055,
        depthWrite: false, toneMapped: false,
      });
      const glint = new THREE.LineLoop(geo, mat);
      const inward = cut.dir === 'N' || cut.dir === 'W' ? 1 : -1;
      if (H) glint.position.set(mid, (y0 + y1) / 2, fixed + inward * (t / 2 + 0.008));
      else {
        glint.position.set(fixed + inward * (t / 2 + 0.008), (y0 + y1) / 2, mid);
        glint.rotation.y = Math.PI / 2;
      }
      glint.renderOrder = 2;
      this.scene.add(glint);
      this.windowOpenings.push({
        id: cut.opts.id || `window:${cut.lv}:${cut.ex},${cut.ez}`,
        level: cut.lv,
        center: H
          ? new THREE.Vector3(mid, (y0 + y1) / 2, fixed)
          : new THREE.Vector3(fixed, (y0 + y1) / 2, mid),
        normal: H ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0),
        horizontal: H ? 'x' : 'z', width: w, height: y1 - y0,
        glint, hot: 0, aim: 0,
      });
    }
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

  _buildStairs(ramp, mat, guardMat = mat) {
    const rise = 0.185;
    const drop = ramp.y1 - ramp.y0;
    const steps = Math.max(2, Math.round(Math.abs(drop) / rise));
    const along = ramp.axis === 'z' ? ramp.z1 - ramp.z0 : ramp.x1 - ramp.x0;
    const stepLen = along / steps;
    ramp.treadCount = steps;
    ramp.treadColliders = [];
    ramp.edgeColliders = [];

    // Cellar flights need to remain a real piece of architecture from both
    // sides: you walk on top of them, but the high end hangs above a usable
    // basement corridor. The old descending-step formula filled every tread
    // down to basement floor, producing a fake solid wedge; house.js then hid
    // that mistake behind a second stack of boxes. `openUnder` authors actual
    // thin treads instead. Their AABBs are simultaneously walkable from above
    // (Player's STEP_UP rule) and a natural headroom stop from below (HEAD), so
    // there is no broad invisible blocker and no place to walk through wood.
    if (ramp.openUnder) {
      const treadThickness = ramp.treadThickness ?? 0.12;
      const edgeGuards = ramp.edgeGuards !== false;
      const guardThickness = ramp.guardThickness ?? 0.11;
      const guardHeight = ramp.guardHeight ?? 0.72;
      const edgeOpenAtEnd = Math.max(0, ramp.edgeOpenAtEnd || 0);
      const stairId = ramp.id || 'stairs';

      for (let i = 0; i < steps; i++) {
        const y = lerp(ramp.y0, ramp.y1, (i + 1) / steps);
        const flags = { stairId, stairPart: 'tread', stairStep: i };
        if (ramp.axis === 'z') {
          const z0 = ramp.z0 + stepLen * i;
          const z1 = z0 + stepLen + 0.01;
          const z = (z0 + z1) / 2;
          this.box(mat, (ramp.x0 + ramp.x1) / 2, y - treadThickness / 2,
            z, ramp.x1 - ramp.x0, treadThickness, z1 - z0);
          ramp.treadColliders.push(this.addCollider(
            ramp.x0, y - treadThickness, z0,
            ramp.x1, y, z1, flags));

          if (edgeGuards && i < steps - edgeOpenAtEnd) {
            const bottom = y - treadThickness;
            const top = y + guardHeight;
            const h = top - bottom;
            for (const [side, x0, x1] of [
              ['left', ramp.x0, ramp.x0 + guardThickness],
              ['right', ramp.x1 - guardThickness, ramp.x1],
            ]) {
              // Render a real open rail (post + stepped handrail), while its
              // continuous AABB below keeps fast diagonal movement from ever
              // slipping through the narrow gaps between posts.
              this.box(guardMat, (x0 + x1) / 2, top - 0.045,
                z, x1 - x0, 0.09, z1 - z0);
              this.box(guardMat, (x0 + x1) / 2, (bottom + top) / 2,
                z1 - 0.045, x1 - x0, h, 0.075);
              ramp.edgeColliders.push(this.addCollider(
                x0, bottom, z0, x1, top, z1,
                { stairId, stairPart: 'edge', stairSide: side, stairStep: i }));
            }
          }
        } else {
          const x0 = ramp.x0 + stepLen * i;
          const x1 = x0 + stepLen + 0.01;
          const x = (x0 + x1) / 2;
          this.box(mat, x, y - treadThickness / 2,
            (ramp.z0 + ramp.z1) / 2, x1 - x0, treadThickness, ramp.z1 - ramp.z0);
          ramp.treadColliders.push(this.addCollider(
            x0, y - treadThickness, ramp.z0,
            x1, y, ramp.z1, flags));

          if (edgeGuards && i < steps - edgeOpenAtEnd) {
            const bottom = y - treadThickness;
            const top = y + guardHeight;
            const h = top - bottom;
            for (const [side, z0, z1] of [
              ['left', ramp.z0, ramp.z0 + guardThickness],
              ['right', ramp.z1 - guardThickness, ramp.z1],
            ]) {
              this.box(guardMat, x, top - 0.045,
                (z0 + z1) / 2, x1 - x0, 0.09, z1 - z0);
              this.box(guardMat, x1 - 0.045, (bottom + top) / 2,
                (z0 + z1) / 2, 0.075, h, z1 - z0);
              ramp.edgeColliders.push(this.addCollider(
                x0, bottom, z0, x1, top, z1,
                { stairId, stairPart: 'edge', stairSide: side, stairStep: i }));
            }
          }
        }
      }
      return;
    }

    for (let i = 0; i < steps; i++) {
      const y = lerp(ramp.y0, ramp.y1, (i + 1) / steps);
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
    // These two were tuned for the HOUSE and then carried outdoors unchanged,
    // which is why nothing after the house has a dark to be dark in. The
    // director now scales them per act (AMBIENT_BY_ACT) — the house keeps
    // exactly what it had, the outdoors gets to be night.
    const ambient = new THREE.AmbientLight(0x46536e, 0.95);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x2c3852, 0x14100c, 0.75);
    scene.add(hemi);
    this.ambient = ambient;
    this.hemi = hemi;
    this.ambientBase = 0.95;
    this.hemiBase = 0.75;
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
    // Freeze the MOON only. This used to switch renderer.shadowMap.autoUpdate
    // off globally, from the bedroom, at boot — which baked the house's shadow
    // map forever and meant nothing in the rest of the game could ever cast a
    // shadow again, including the light the player carries in their hands.
    if (this.moon) this.moon.shadow.autoUpdate = false;
  }

  _buildCandlePool() {
    this.candlePool = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xff9540, 0, 9, 1.8);
      // Keep the light count resident so crossing the eighth-candle boundary
      // never invalidates every lit material's shader. Inactive slots are true
      // zero-intensity lights, not scene-graph visibility variants.
      l.visible = true;
      l.userData.c = null;
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
        if (c) { l.position.set(c.x, c.y, c.z); l.userData.c = c; }
        else { l.intensity = 0; l.userData.c = null; }
      }
    }
    for (const l of this.candlePool) {
      const c = l.userData.c;
      if (!c) { l.intensity = 0; continue; }
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
    // doorway center on the wall plane — the nav node enemies steer through
    this.center = H ? { x: mid, z: fixed } : { x: fixed, z: mid };

    const M = world.mats;
    const scene = world.scene;
    // hinge at the opening edge
    this.group = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.05, 0.09), M.woodDark);
    panel.position.set((w - 0.06) / 2, 0, 0);
    this.group.add(panel);
    this.panel = panel;

    // door grammar (playtest 2): what a door will do must read at a glance,
    // from either face. Knob = it opens. Knob above a keyhole plate = it
    // needs a key. No knob at all = it never opens. Boards = throw the skull.
    this.knobs = null;
    this.rattleT = 0;
    if (this.locked !== 'never') {
      const brass = new THREE.MeshStandardMaterial({ color: 0xb08d4a, metalness: 0.85, roughness: 0.28 });
      this.knobs = new THREE.Group();
      for (const side of [1, -1]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), brass);
        knob.scale.z = 0.8;
        knob.position.set(w - 0.2, -0.05, side * 0.085);
        const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 10), brass);
        rose.rotation.x = Math.PI / 2;
        rose.position.set(w - 0.2, -0.05, side * 0.048);
        this.knobs.add(knob, rose);
      }
      if (this.locked && this.locked !== 'boards') {
        // keyhole escutcheon under the knob — pale plate, black slot
        const plateM = new THREE.MeshStandardMaterial({ color: 0x918b7a, metalness: 0.6, roughness: 0.45 });
        const slotM = new THREE.MeshBasicMaterial({ color: 0x000000 });
        for (const side of [1, -1]) {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.012), plateM);
          plate.position.set(w - 0.2, -0.25, side * 0.048);
          const slot = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.075, 0.016), slotM);
          slot.position.set(w - 0.2, -0.26, side * 0.05);
          this.knobs.add(plate, slot);
        }
      }
      this.group.add(this.knobs);
    }

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
    if (this.locked === 'never') {
      // no knob, nothing to work: a dead thud. the door doesn't even shiver.
      game.audio.thud({ pos: this.group.position, gain: 0.5, rate: 0.55 });
      game.shake(0.08);
      return;
    }
    if (this.locked === 'boards') {
      game.audio.lockedRattle({ pos: this.group.position });
      this.rattleT = 0.45;
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
        this.rattleT = 0.45;
        game.shake(0.1);
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
    // locked jiggle: the knob works, the panel knocks in its frame, nothing gives
    if (this.rattleT > 0) {
      this.rattleT -= dt;
      const baseRy = (this.group.userData.baseRy ??= this.group.rotation.y);
      const k = this.rattleT > 0 ? Math.sin(this.rattleT * 60) * Math.min(1, this.rattleT * 4) : 0;
      this.group.rotation.y = baseRy + k * 0.012;
      if (this.knobs) this.knobs.rotation.x = k * 0.6;
    }
  }
}

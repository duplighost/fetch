// underfalls.js — the skull-less district behind the waterfall.
//
// Contract: this module owns the cave's route math, structural geometry,
// progression-neutral horror beats, and hatch. outside.js mounts it; the
// atmosphere pass reads the exported layout to dress the exact same space.
// Every floor sample and lateral clamp comes from one route description so a
// beautiful ledge can never secretly be a hole.
import * as THREE from 'three';
import { clamp, lerp, RNG, smoothstep, TAU } from './util.js';

const MAIN_LOCAL = Object.freeze([
  Object.freeze({ x: 0,  z: 22,  y: 0.00, w: 2.30, name: 'stone veil' }),
  Object.freeze({ x: 2,  z: 30,  y: 0.00, w: 2.45, name: 'undertow throat' }),
  Object.freeze({ x: 7,  z: 36,  y: 0.00, w: 3.20, name: 'intake apse' }),
  Object.freeze({ x: 14, z: 40,  y: 0.00, w: 4.60, name: 'pump approach' }),
  Object.freeze({ x: 16, z: 50,  y: 0.00, w: 4.75, name: 'chapel west aisle' }),
  Object.freeze({ x: 28, z: 56,  y: 0.00, w: 4.75, name: 'chapel east aisle' }),
  Object.freeze({ x: 36, z: 49,  y: 0.00, w: 3.00, name: 'east ambulatory' }),
  Object.freeze({ x: 35, z: 62,  y: 0.00, w: 2.65, name: 'lower sluice' }),
  Object.freeze({ x: 40, z: 69,  y: 1.60, w: 2.50, name: 'sluice rise' }),
  Object.freeze({ x: 46, z: 78,  y: 3.20, w: 2.55, name: 'upper sluice' }),
  Object.freeze({ x: 55, z: 87,  y: 3.20, w: 2.75, name: 'overflow gallery' }),
  Object.freeze({ x: 60, z: 96,  y: 0.00, w: 2.65, name: 'spill descent' }),
  Object.freeze({ x: 68, z: 104, y: 0.00, w: 3.80, name: 'hatch cistern' }),
]);

// A no-key route concealed behind the pump chapel's dripping central aisle.
// It is a real shortcut, not a collectible closet: looking closely saves a
// little distance and exposes the bell cistern, then rejoins the upper sluice.
const SECRET_LOCAL = Object.freeze([
  Object.freeze({ x: 14, z: 40, y: 0.00, w: 1.55, name: 'culvert mouth' }),
  Object.freeze({ x: 22, z: 48, y: 0.00, w: 1.45, name: 'dry return' }),
  Object.freeze({ x: 22, z: 59, y: 0.00, w: 1.55, name: 'pump undercroft' }),
  Object.freeze({ x: 27, z: 68, y: 1.25, w: 3.25, name: 'bell cistern' }),
  Object.freeze({ x: 37, z: 75, y: 2.40, w: 1.55, name: 'service climb' }),
  Object.freeze({ x: 46, z: 78, y: 3.20, w: 1.70, name: 'overflow shortcut' }),
]);

const CHAMBERS_LOCAL = Object.freeze([
  Object.freeze({ x: 7,  z: 36,  y: 0.00, r: 4.30, name: 'intake apse' }),
  Object.freeze({ x: 22, z: 54,  y: 0.00, r: 10.50, name: 'drowned pump chapel' }),
  Object.freeze({ x: 27, z: 68,  y: 1.25, r: 3.45, name: 'bell cistern', secret: true }),
  Object.freeze({ x: 55, z: 87,  y: 3.20, r: 4.80, name: 'overflow gallery' }),
  Object.freeze({ x: 68, z: 104, y: 0.00, r: 4.25, name: 'hatch cistern' }),
]);

// Navigation-only turns are deliberately sparse. The public route already owns
// every major decision; this single north-transept point keeps a body-radius
// route around the chapel's real eastern pillar/altar cluster without making a
// second, invisible path network.
const NAVIGATION_LOCAL = Object.freeze([
  Object.freeze({ x: 29.25, z: 55.75, y: 0.00, name: 'chapel north transept' }),
]);

// THE ONE PAD. No drawn surface in this district may stand closer than this
// to any pose the clamp will accept. It is the player's own radius (RADIUS
// 0.34, player.js) plus the clamp's 0.08 dead band. Below it the player's body
// is inside the rock; below 0.24 (the camera's near plane of 0.2, main.js, plus
// the 0.04 of slack installClamp leaves) the surface is CLIPPED AWAY and you
// look straight through the wall, which is what he photographed.
export const UNDERFALLS_SOLID_PAD = 0.42;
// The flank wall stands one post-depth clear of that pad, so the sluice gate's
// iron reads AGAINST stone instead of inside it. The sluice-rise and
// upper-sluice nodes are near-straight, so gate and wall both seat at about
// clearance 0.445 against a single pad — and a 0.23 m post buried in a 0.54 m
// slab is a post nobody can see. Two pads, and the gates keep their vertical.
export const UNDERFALLS_WALL_PAD = UNDERFALLS_SOLID_PAD + 0.30;
// How far a flank piece may be pushed outward to find that pad before it is
// dropped instead. Beyond this the enclosure genuinely belongs to another
// region and shoving the flank out would read as a hole.
export const UNDERFALLS_WALL_MAX_PUSH = 1.55;

export const UNDERFALLS_METRICS = Object.freeze({
  oldRouteMeters: 31.2,
  mainRouteMeters: 0, // calculated world value is exposed on the built layout
  maxRise: 3.2,
  routeFloorMin: 0,
  routeFloorMax: 3.2,
});

function worldNode(C, p) {
  return { ...p, x: C.x + p.x, z: C.z + p.z };
}

function pathLength(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

function makeSegments(path, kind) {
  const out = [];
  let distance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    out.push({ a, b, dx, dz, length, length2: length * length, distance, kind, index: i });
    distance += length;
  }
  return out;
}

export function createUnderfallsLayout(center) {
  const C = { x: center.x, z: center.z };
  const main = MAIN_LOCAL.map((p) => worldNode(C, p));
  const secret = SECRET_LOCAL.map((p) => worldNode(C, p));
  const chambers = CHAMBERS_LOCAL.map((p) => worldNode(C, p));
  const navigationWaypoints = NAVIGATION_LOCAL.map((p) => worldNode(C, p));
  const mainSegments = makeSegments(main, 'main');
  const secretSegments = makeSegments(secret, 'secret');
  const named = Object.fromEntries(main.map((p) => [p.name, p]));
  const chapel = chambers.find((c) => c.name === 'drowned pump chapel');
  const lowerSluice = named['lower sluice'];
  const sluiceRise = named['sluice rise'];
  const upperSluice = named['upper sluice'];
  const overflow = named['overflow gallery'];
  const sprayZones = [
    {
      name: 'lower-sluice-burst',
      pos: new THREE.Vector3(sluiceRise.x + 1.75, sluiceRise.y + 1.35, sluiceRise.z - 1.15),
      radius: 4.65,
      strength: 0.78,
    },
    {
      name: 'high-spill',
      pos: new THREE.Vector3(overflow.x - 3.15, overflow.y + 1.75, overflow.z - 0.65),
      radius: 5.25,
      strength: 1.08,
    },
    // the new route-spanning curtains get their own crossing pulses: the
    // first veil just inside the falls, and the last one before the hatch
    {
      name: 'entry-veil',
      pos: new THREE.Vector3((main[0].x + main[1].x) / 2, 1.3, (main[0].z + main[1].z) / 2),
      radius: 4.2,
      strength: 0.7,
    },
    {
      name: 'hatch-veil',
      pos: new THREE.Vector3((main[11].x + main[12].x) / 2, 1.3, (main[11].z + main[12].z) / 2),
      radius: 4.2,
      strength: 0.72,
    },
  ];
  // THE CURTAINS YOU WALK THROUGH, one entry per drawn sheet. Six of them span
  // the route (atmosphere.js's curtainAt), and until now only two had any
  // player-facing consequence at all -- the entry and hatch veils, which also
  // happen to be spray zones. The other four were scenery you walked through
  // and nothing happened.
  //
  // A curtain is a SLAB, not a disc: the sheet is one plane across its leg, so
  // the test is 0.9 m either side of that plane and half its drawn width
  // across. A 3 m disc would soak you standing a corridor's width away from
  // any water.
  //
  // COUPLED TO atmosphere.js: the leg index list below is the same one the
  // drawn sheets are built from (search curtainAt). If one list changes and
  // the other does not, the lens gets wet where no water is drawn. Change both
  // in the same edit.
  const curtainSlab = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      x: (a.x + b.x) / 2,
      y: ((a.y || 0) + (b.y || 0)) / 2 + 1.3,
      z: (a.z + b.z) / 2,
      tx: dx / len, tz: dz / len,                        // the slab's thin axis
      half: ((a.w || 2.5) + (b.w || 2.5)) * 0.5 + 0.3,   // the sheet's own reach
      depth: 0.9,
    };
  };
  const curtains = [[0, 1], [1, 2], [8, 9], [9, 10], [11, 12]]
    .map(([i, j]) => curtainSlab(main[i], main[j]));
  if (secret[0] && secret[1]) curtains.push(curtainSlab(secret[0], secret[1]));
  const bounds = {
    minX: C.x - 10,
    maxX: C.x + 74,
    minZ: C.z + 20.35,
    maxZ: C.z + 110,
  };
  return {
    center: C,
    main,
    secret,
    chambers,
    navigationWaypoints,
    mainSegments,
    secretSegments,
    segments: [...mainSegments, ...secretSegments],
    bounds,
    mainLength: pathLength(main),
    secretLength: pathLength(secret),
    entrance: main[0],
    hatch: main[main.length - 1],
    named,
    chapel,
    bellCistern: chambers.find((c) => c.name === 'bell cistern'),
    lowerSluice,
    sluiceRise,
    upperSluice,
    overflow,
    sprayZones,
    curtains,
  };
}

function segmentProjection(seg, x, z) {
  const t = clamp(((x - seg.a.x) * seg.dx + (z - seg.a.z) * seg.dz) / (seg.length2 || 1), 0, 1);
  const cx = seg.a.x + seg.dx * t;
  const cz = seg.a.z + seg.dz * t;
  const d = Math.hypot(x - cx, z - cz);
  const w = lerp(seg.a.w, seg.b.w, t);
  return {
    type: 'segment', kind: seg.kind, index: seg.index, t, cx, cz, d, w,
    y: lerp(seg.a.y, seg.b.y, t),
    clearance: d - w,
    routeDistance: seg.distance + seg.length * t,
  };
}

function chamberProjection(chamber, x, z) {
  const d = Math.hypot(x - chamber.x, z - chamber.z);
  return {
    type: 'chamber', kind: chamber.secret ? 'secret' : 'main', chamber,
    cx: chamber.x, cz: chamber.z, d, w: chamber.r, y: chamber.y,
    clearance: d - chamber.r,
    routeDistance: null,
  };
}

// The same projection, but over the MAIN route only, plus its inverse. The
// Choir's surfacings are placed with these (round six, his note 3: "make that
// enemy teleport in front of you, a few times"), and the union projection
// above cannot do it: it can answer with a SECRET segment, whose distances are
// measured along its own path, so "twelve metres ahead" would mean twelve
// metres along a corridor the player is not walking.
export function projectUnderfallsMain(layout, x, z) {
  let best = null;
  for (const seg of layout.mainSegments) {
    const p = segmentProjection(seg, x, z);
    if (!best || p.clearance < best.clearance) best = p;
  }
  return best;
}

// The world point a given distance along the main route, with the corridor
// half-width there — a body wider than the corridor would plug it, and running
// past this thing is the whole escape.
export function underfallsMainPointAt(layout, routeDistance) {
  const segs = layout?.mainSegments;
  if (!segs?.length) return null;
  const last = segs[segs.length - 1];
  const total = last.distance + last.length;
  const d = clamp(routeDistance, 0, total);
  let seg = last;
  for (const s of segs) {
    if (d <= s.distance + s.length) { seg = s; break; }
  }
  const t = clamp((d - seg.distance) / (seg.length || 1), 0, 1);
  return {
    x: seg.a.x + seg.dx * t,
    z: seg.a.z + seg.dz * t,
    y: lerp(seg.a.y, seg.b.y, t),
    w: lerp(seg.a.w, seg.b.w, t),
    index: seg.index, t, routeDistance: d, remaining: total - d, total,
  };
}

// Signed walk-region query: clearance <= 0 is valid floor. The smallest
// clearance wins, which correctly treats crossing corridors and chambers as a
// union instead of letting one narrow branch pinch another shut.
export function projectUnderfalls(layout, x, z) {
  let best = null;
  for (const seg of layout.segments) {
    const p = segmentProjection(seg, x, z);
    if (!best || p.clearance < best.clearance) best = p;
  }
  for (const chamber of layout.chambers) {
    const p = chamberProjection(chamber, x, z);
    if (!best || p.clearance < best.clearance) best = p;
  }
  return best;
}

export function underfallsContains(layout, x, z, pad = 0) {
  const p = projectUnderfalls(layout, x, z);
  return !!p && p.clearance <= pad;
}

// Terrain uses this even for the small distance crossed before postClamp runs.
// Returning the nearest authored floor throughout the district bounds prevents
// a high-gallery escape from dropping to y=0 for one lethal frame.
export function underfallsGroundAt(layout, x, z) {
  const b = layout.bounds;
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return null;
  let nearestSegment = null;
  for (const seg of layout.segments) {
    const p = segmentProjection(seg, x, z);
    if (!nearestSegment || p.d < nearestSegment.d) nearestSegment = p;
  }
  // Where a route crosses a broad chamber, its interpolated elevation wins.
  // This prevents the bell-cistern disc from flattening either end of the
  // service ramp into an invisible 1.25m step.
  if (nearestSegment && nearestSegment.d <= nearestSegment.w + 0.38) return nearestSegment.y;
  let chamberFloor = null;
  for (const chamber of layout.chambers) {
    const d = Math.hypot(x - chamber.x, z - chamber.z);
    if (d <= chamber.r && (!chamberFloor || d / chamber.r < chamberFloor.score)) {
      chamberFloor = { y: chamber.y, score: d / chamber.r };
    }
  }
  if (chamberFloor) return chamberFloor.y;
  return nearestSegment?.y ?? 0;
}

// A straight chord is traversable only when its whole footprint remains in
// the authored corridor/chamber union and on the same continuous floor. This
// is deliberately stricter than a Euclidean distance check: two wet walls can
// be centimetres apart while the walk between them is half the district.
export function underfallsLineOfSight(layout, a, b, {
  pad = 0.18,
  sampleSpacing = 0.32,
  floorTolerance = 0.62,
} = {}) {
  if (!layout || !a || !b) return false;
  // postClamp deliberately permits a legal actor centre eight centimetres from
  // the route-union edge. Route clearance is wider than that. Pull only the two
  // query endpoints inward before testing the chord, so a legal shoulder pose
  // can enter navigation while every interior sample still pays the full pad.
  // This is not a relaxed wall test: off-floor endpoints are rejected first.
  const insetEndpoint = (point) => {
    const projection = projectUnderfalls(layout, point.x, point.z);
    if (!projection || projection.clearance > 1e-4) return null;
    let x = point.x, z = point.z;
    if (pad > 0 && projection.clearance > -pad) {
      const safeDistance = Math.max(0, projection.w - pad - 0.002);
      if (projection.d <= 1e-8) {
        x = projection.cx;
        z = projection.cz;
      } else {
        const scale = Math.min(1, safeDistance / projection.d);
        x = projection.cx + (point.x - projection.cx) * scale;
        z = projection.cz + (point.z - projection.cz) * scale;
      }
    }
    return {
      x,
      y: Number.isFinite(point.y) ? point.y : underfallsGroundAt(layout, x, z),
      z,
    };
  };
  const start = insetEndpoint(a), end = insetEndpoint(b);
  if (!start || !end) return false;
  const dx = end.x - start.x, dz = end.z - start.z;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / Math.max(0.12, sampleSpacing)));
  const ay = start.y;
  const by = end.y;
  let previousGround = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(start.x, end.x, t), z = lerp(start.z, end.z, t);
    const projection = projectUnderfalls(layout, x, z);
    if (!projection || projection.clearance > -pad + 1e-4) return false;
    const ground = underfallsGroundAt(layout, x, z);
    const expected = lerp(ay, by, t);
    if (!Number.isFinite(ground) || Math.abs(ground - expected) > floorTolerance) return false;
    // Authored ramps rise gradually. A discontinuous storey selection at an XZ
    // crossing is not a route, even if both endpoints happen to be legal floor.
    if (previousGround != null && Math.abs(ground - previousGround) > 0.48) return false;
    previousGround = ground;
  }
  return true;
}

function navigationNodeKey(p) {
  return `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
}

function buildUnderfallsNavigation(layout) {
  const byPosition = new Map();
  const add = (point, kind, name) => {
    const key = navigationNodeKey(point);
    let node = byPosition.get(key);
    if (!node) {
      node = {
        id: byPosition.size,
        x: point.x, y: point.y, z: point.z,
        kinds: new Set(), names: new Set(), edges: [],
      };
      byPosition.set(key, node);
    }
    node.kinds.add(kind);
    if (name) node.names.add(name);
    return node;
  };
  for (const point of layout.main) add(point, 'main', point.name);
  for (const point of layout.secret) add(point, 'secret', point.name);
  for (const chamber of layout.chambers) {
    add(chamber, chamber.secret ? 'secret' : 'chamber', chamber.name);
  }
  for (const point of layout.navigationWaypoints || []) add(point, 'navigation', point.name);
  const nodes = [...byPosition.values()];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (!underfallsLineOfSight(layout, a, b, { pad: 0.2 })) continue;
      const cost = Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y);
      a.edges.push({ to: j, cost });
      b.edges.push({ to: i, cost });
    }
  }
  return { nodes };
}

// Deterministic shortest route through the same corridor/chamber union that
// clamps the player. `edgeAllowed` lets a caller reject a chord blocked by a
// live structural collider (the pump altar, pillars, a closed seal) without
// teaching this pure layout module about the World class.
export function findUnderfallsRoute(layout, from, to, {
  pad = 0.18,
  edgeAllowed = null,
} = {}) {
  if (!layout || !from || !to) return null;
  const start = {
    x: from.x,
    y: Number.isFinite(from.y) ? from.y : underfallsGroundAt(layout, from.x, from.z),
    z: from.z,
  };
  const end = {
    x: to.x,
    y: Number.isFinite(to.y) ? to.y : underfallsGroundAt(layout, to.x, to.z),
    z: to.z,
  };
  const canUse = (a, b) => underfallsLineOfSight(layout, a, b, { pad })
    && (!edgeAllowed || edgeAllowed(a, b));
  const directDistance = Math.hypot(end.x - start.x, end.z - start.z, end.y - start.y);
  if (canUse(start, end)) {
    return {
      reachable: true,
      direct: true,
      distance: directDistance,
      points: [{ ...end, kinds: [], names: [] }],
      usesSecret: false,
    };
  }

  const navigation = layout.navigation || (layout.navigation = buildUnderfallsNavigation(layout));
  const base = navigation.nodes;
  const startIndex = base.length;
  const endIndex = base.length + 1;
  const count = base.length + 2;
  const dist = new Array(count).fill(Infinity);
  const prev = new Array(count).fill(-1);
  const used = new Array(count).fill(false);
  dist[startIndex] = 0;

  const pointAt = (index) => index === startIndex ? start : index === endIndex ? end : base[index];
  const neighbours = (index) => {
    const out = [];
    if (index < base.length) {
      for (const edge of base[index].edges) {
        if (!edgeAllowed || edgeAllowed(base[index], base[edge.to])) out.push(edge);
      }
      if (canUse(base[index], end)) {
        out.push({ to: endIndex, cost: Math.hypot(
          end.x - base[index].x, end.z - base[index].z, end.y - base[index].y,
        ) });
      }
    } else if (index === startIndex) {
      for (let i = 0; i < base.length; i++) {
        if (!canUse(start, base[i])) continue;
        out.push({ to: i, cost: Math.hypot(
          base[i].x - start.x, base[i].z - start.z, base[i].y - start.y,
        ) });
      }
    }
    return out;
  };

  for (let pass = 0; pass < count; pass++) {
    let current = -1;
    for (let i = 0; i < count; i++) {
      if (!used[i] && Number.isFinite(dist[i]) && (current < 0 || dist[i] < dist[current])) current = i;
    }
    if (current < 0 || current === endIndex) break;
    used[current] = true;
    for (const edge of neighbours(current)) {
      const next = dist[current] + edge.cost;
      if (next + 1e-7 >= dist[edge.to]) continue;
      dist[edge.to] = next;
      prev[edge.to] = current;
    }
  }
  if (!Number.isFinite(dist[endIndex])) {
    return { reachable: false, direct: false, distance: Infinity, points: [], usesSecret: false };
  }
  const indices = [];
  for (let at = endIndex; at !== startIndex && at >= 0; at = prev[at]) indices.push(at);
  indices.reverse();
  const points = indices.map((index) => {
    const point = pointAt(index);
    return {
      x: point.x, y: point.y, z: point.z,
      kinds: point.kinds ? [...point.kinds] : [],
      names: point.names ? [...point.names] : [],
    };
  });
  return {
    reachable: true,
    direct: false,
    distance: dist[endIndex],
    points,
    usesSecret: points.some((point) => point.kinds.includes('secret')),
  };
}

export function sampleUnderfallsPath(path, spacing = 0.75) {
  const samples = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(length / spacing));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      samples.push({
        x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t),
        y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t),
        segment: i, t,
      });
    }
  }
  samples.push({ ...path[path.length - 1], segment: path.length - 2, t: 1 });
  return samples;
}

function addFloorAndShell(game, layout) {
  const { world, mats: M } = game;
  let routeRoofs = 0;
  let chamberCaps = 0;
  // The tread cadence makes the changing elevation visible while collision
  // remains the smoother shared route height. Every tread sits just below that
  // height, so it can never become a surprise wall or counterfeit platform.
  for (const seg of layout.segments) {
    const n = Math.max(2, Math.ceil(seg.length / 0.9));
    const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
    const nx = tz, nz = -tx;
    const yaw = Math.atan2(seg.dx, seg.dz);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = lerp(seg.a.x, seg.b.x, t);
      const z = lerp(seg.a.z, seg.b.z, t);
      const y = lerp(seg.a.y, seg.b.y, t);
      const w = lerp(seg.a.w, seg.b.w, t);
      // 12 mm under the chamber discs (which top out at chamber.y exactly).
      // These strips run THROUGH every chamber, so at the same y they shared a
      // plane with the disc bit-for-bit over ~225 m2 at the chapel alone — and
      // two coplanar opaque surfaces with different tessellation is what
      // z-fight speckle is. Ground height here is analytic (underfallsGroundAt),
      // so a 12 mm cosmetic drop costs the player nothing.
      world.box(M.rock, x, y - 0.122, z, w * 2.0, 0.22, seg.length / n + 0.08, yaw);
    }
    const avgY = (seg.a.y + seg.b.y) * 0.5;
    const avgW = (seg.a.w + seg.b.w) * 0.5;
    // Every route leg owns continuous overburden, including the long joins
    // whose endpoints open into chambers. Previously those whole joins skipped
    // their roof along with their side walls, leaving strips of moon and stars
    // visible between the decorative chamber caps.
    world.box(M.rock,
      (seg.a.x + seg.b.x) * 0.5, avgY + 4.86,
      (seg.a.z + seg.b.z) * 0.5,
      avgW * 2 + 1.25, 0.46, seg.length + 1.4, yaw);
    routeRoofs++;
    // Chambers own their perimeter. Carrying corridor side-wall boxes through
    // them partitions the landmark into black slabs and makes a broad room
    // look like several accidental closets. The floor remains continuous;
    // the chamber's outer rock ring and cap provide the actual enclosure.
    //
    // BUT THAT IS A TEST ON THE PIECE, NOT ON THE LEG. It used to be checked
    // against the leg's two ENDPOINTS, so one endpoint brushing a chamber
    // deleted the backing for the whole leg: twelve of seventeen legs had no
    // structural side wall at all — the chapel approach, the whole spill
    // descent, the whole culvert — while the atmosphere pass went on dressing
    // them per sample (atmosphere.js, buildCaveDress). The two layers
    // disagreed about where a wall existed, and where the structure was
    // missing there was nothing behind the skin but the 0x03050c background:
    // "the rest black". They agree now; the per-piece test is in the loop.
    // Structural backing behind the later low-poly rock skin. It is deliberately
    // not an AABB collider: diagonal wall boxes were the old forest trap bug.
    //
    // AND IT FOLLOWS THE LANE NOW, PIECE BY PIECE, INSTEAD OF ONE SLAB PER LEG.
    //
    // These used to be two boxes the length of the whole leg, offset from its
    // centre line by the leg's AVERAGE width — while the thing that keeps a
    // player on the route is a clamp using the LOCAL width, interpolated along
    // it (state.clamp, below). On any leg that tapers the two disagree at the
    // wide end, and the walkable lane runs straight through the drawn wall: up
    // to 0.64 m into it between the chapel east aisle and the east ambulatory,
    // 0.47 at the intake apse, 0.35 at the spill descent. Nothing in this
    // district has a collider, so there is nothing to stop you — you simply
    // walk into rock and the rock is not there. Alex, on the live build:
    // "some of these walls you can walk right through", and worse, "some of
    // these walls you basically are forced to walk through to get there".
    //
    // It was invisible until round eleven gave the cave its floor back, because
    // an undrawn wall cannot be walked through in any way a player notices.
    //
    // Two changes, both here: place every piece at the LOCAL w, and drop any
    // piece whose footprint stands in the walkable union at all. About a third
    // of them do, at corners and at the main/secret crossing, and every one of
    // those places already owns its enclosure from another region's flanks,
    // roofs or chamber cap. Pushing them outward instead would shove one flank
    // nine metres to clear the chapel disc and read as a hole. Draw cost is
    // unchanged either way: it is all one merged batch.
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const px = lerp(seg.a.x, seg.b.x, t);
      const pz = lerp(seg.a.z, seg.b.z, t);
      const py = lerp(seg.a.y, seg.b.y, t);
      const pw = lerp(seg.a.w, seg.b.w, t);
      const depth = seg.length / n + 0.08;
      // the atmosphere skin's own rule, verbatim (atmosphere.js, buildCaveDress)
      if (layout.chambers.some((chamber) =>
        Math.hypot(px - chamber.x, pz - chamber.z) < chamber.r * 0.94)) continue;
      for (const side of [1, -1]) {
        // ROUND TWELVE PUT THESE AT THE LOCAL WIDTH. THAT WAS HALF THE FIX.
        //
        // A piece at pw + 0.42 has its inner FACE at pw + 0.15, and the clamp
        // stably permits a camera at pw - 0.04: installClamp declines to act
        // until clearance > -0.04, then snaps to w - 0.08. Replayed against
        // every pose the clamp will hold, ALL 81 pieces round twelve drew
        // stood within 0.2 m of one, the worst 0.045 m on the service-climb
        // leg — and the camera's near plane is 0.2 (main.js). Lean
        // into the wall and the whole face is clipped away and you look
        // through it: "some of these walls you can walk right through".
        // Nothing here is a collider, so nothing stops you either.
        //
        // The offset is found against the UNION now, not against this leg:
        // push outward until the whole footprint clears the wall pad, and drop
        // the piece only if that would take it past the max push — at those
        // places another region's lane is genuinely there and already owns the
        // enclosure. tools/probe-district-walls.mjs replays all of this in
        // plain node against the real route tables.
        let cx = 0, cz = 0, seated = false, seatPush = 0;
        for (let push = 0; push <= UNDERFALLS_WALL_MAX_PUSH + 1e-9; push += 0.05) {
          cx = px + side * nx * (pw + 0.42 + push);
          cz = pz + side * nz * (pw + 0.42 + push);
          // nine points over the piece's own footprint, in its own frame.
          // The only question is whether the WORST of them clears the pad, so
          // the first one that does not ends this attempt: 43767 projections
          // become 6751, and 75 ms of build time becomes 11. Same seating on
          // every one of the pieces — this prunes work, not candidates.
          let clears = true;
          for (let a = -1; a <= 1 && clears; a++) {
            for (let b = -1; b <= 1 && clears; b++) {
              const ox = side * nx * (a * 0.27) + tx * (b * depth * 0.5);
              const oz = side * nz * (a * 0.27) + tz * (b * depth * 0.5);
              const hit = projectUnderfalls(layout, cx + ox, cz + oz);
              if (hit && hit.clearance < UNDERFALLS_WALL_PAD) clears = false;
            }
          }
          if (clears) { seatPush = push; seated = true; break; }
        }
        if (!seated) continue;
        // AND IT REACHES THE ROOF. The overburden above is ONE flat slab per
        // leg at avgY + 4.86 while these pieces staircase with py, so on a
        // rising leg the wall top (py + 4.925) fell below the roof underside
        // (avgY + 4.63): a 0.43 m open slot up the first flight of the sluice
        // climb, 0.44 m up the second, black all the way. Growing to the
        // roof's TOP face rather than its underside also guarantees no wall
        // fin ever stands proud of the overburden on a descending leg.
        const bottom = py - 0.225;
        const height = (avgY + 5.09) - bottom;
        world.box(M.rock, cx, bottom + height * 0.5, cz, 0.54, height, depth, yaw);
        // AND THE SHOULDER IS FLOORED. The route floor above is exactly 2 * w
        // wide, so pushing the wall out opens an unlit, unfloored slot between
        // the floor edge and the wall base — 0.15 m before, up to 1.6 m now —
        // and under the slab's 0.22 m side face there is nothing at all: you
        // look past it into the 0x03050c background, on the one district whose
        // note is "the rest black". Bridge it here. It is the same merged
        // M.rock shell, so it costs vertices and not one draw call.
        const skirt = 0.15 + seatPush;
        world.box(M.rock,
          px + side * nx * (pw + skirt * 0.5), py - 0.11,
          pz + side * nz * (pw + skirt * 0.5), skirt + 0.06, 0.22, depth, yaw);
        // Publish the drawn face so tests/underfalls-expansion.mjs can ask the
        // only question that matters here: can a pose the clamp accepts stand
        // inside it. FACES, not AABBs — main#7's yaw is 35.5 degrees and a
        // rotated 0.54 x 0.95 box has a 0.99 m AABB, 0.22 m fatter into the
        // lane than the box itself. That overstatement is the forest trap.
        publishSolid(layout, {
          name: 'cave flank wall', guard: 'clamp',
          y0: bottom, y1: bottom + height,
          x: cx, z: cz, nx, nz, tx, tz, halfN: 0.27, halfT: depth * 0.5,
        });
      }
    }
  }

  // THE WET WALKWAY — IT IS PAVED NOW, NOT A RIBBON.
  //
  // It still runs the whole MAIN route and none of the culvert: the way
  // forward is the wet way, told in value and geometry, never in hue.
  //
  // What stood here was ONE continuous strip — 145 boxes over 125.16 m, each
  // 2.12–3.44 m wide and ~0.9 m long, butted with a 61 mm OVERLAP (measured
  // 60.5–61.9 across the twelve legs) so not even a hairline showed, and with
  // coplanar tops inside one merged batch, so every joint was two different
  // parts of one texture arguing over the same depth. BoxGeometry UVs are
  // 0..1 PER FACE — the law round twelve wrote down for the ossuary flicker
  // (515ebef) — so ONE 256 px headstone tile was stretched over each of those
  // pieces: a 2.4:1 to 3.8:1 anisotropic smear, with the map's only large
  // features (three cracks, six lichen discs) repeating identically every
  // 0.9 m. That stretch also killed the BUMP, which was the only channel left
  // that could put relief into a flat floor: perturbNormalArb reads dFdx of
  // the height map, and a 256 px height field spread over 3.4 m has no
  // gradient left to read.
  //
  // Nothing else modulated it either. No light in this district casts a
  // shadow. The baked contact shading is derived from COLLIDERS and the route
  // deliberately has none. The emissive was a CONSTANT with no emissiveMap.
  // Alex, on the live build: "walkway under waterfall doesn't look good" —
  // one huge pale flat slab, black either side. It was never too bright.
  // There was no surface on it.
  //
  // The same UV law that flattened it makes flags right for free. Cut the
  // strip into stones of about 0.55 x 0.80 m and each wears ONE whole tile at
  // the scale this material is already used at elsewhere — outside.js lays
  // M.headstone flat as 0.52 x 0.72 m slabs at the marrow pit, and the map was
  // painted to be a headstone, whose face is 0.74 m. Recomputed over the 676
  // stones this lays down: the bump gradient comes back 5.3x across the route
  // on average (3.2x to 6.6x) and 1.14x along it, and the texel aspect falls
  // from 2.4–3.8:1 to 1.16–1.63:1. No new texture: the tiling came out of the
  // geometry.
  //
  // Four things now modulate what was one flat field:
  //   * a 55 mm JOINT both ways, showing the dark floor between stones. The
  //     sluice treads next door are the one route surface in this district he
  //     did NOT complain about, and they carry a worse smear than the ribbon
  //     did — what they have that it lacked is 196–223 mm of gap between them.
  //     The joints are what makes paving read.
  //   * three value tiers running centre-bright to edge-dark, which is the
  //     cave rocks' own ladder (atmosphere.js) turned on its side, carried in
  //     BOTH diffuse and emissive so it survives the stretches no light
  //     reaches. Tier one is exactly today's value and nothing gets brighter,
  //     so the paving's mean value lands at 0.879 of the old ribbon's with a
  //     0.52 kerb outside it. That is the one number here that wants a frame:
  //     the point is walkway-against-shoulder CONTRAST, and contrast is not
  //     brightness — but a district this dark can lose a surface by dimming
  //     it, so it is worth looking at before anything else darkens.
  //   * a darker broken verge on both shoulders, so the pale stops ending in
  //     nothing.
  //   * per-stone tilt, lift and yaw from a seeded RNG — never Math.random, or
  //     the probes and the screenshots stop repeating.
  //
  // Courses alternate a quarter-cell either side of the centre line so no
  // cross joint runs two rows deep. The verge rides that same shift: move the
  // flags without the kerb and the outer stone climbs through it on every
  // second course.
  //
  // Instanced, not merged: one merged shell batch becomes four instanced ones,
  // so the cave pays +3 draw calls against the 450 ceiling
  // district-culling-regression asserts (its current total was not measured
  // here). GPU geometry goes DOWN: one shared 24-vertex box carries 966
  // instances where the ribbon merged 145 segmented boxes into 6,208 vertices
  // and 4,468 triangles, and the instance matrices are 62 KB of static-usage
  // buffer. Boot trades 966 matrix compositions for 145 BoxGeometry
  // allocations plus their share of the finishStatic merge — a wash, and
  // unmeasured.
  //
  // Nothing here is a collider and no stone is over 0.08 m thick.
  // underfallsGroundAt is analytic, so none of it can become a step, a ledge
  // or a walk-through wall. The widest course plus its verge reaches 2.22 m
  // against a route half-width that is never below 2.30, leaving 0.71 m of
  // margin at the tightest point. Flag tops sit at route y + 0.042 — exactly
  // where the ribbon's flat top was — and with the per-stone tilt and lift the
  // highest corner in the district reaches y + 0.065 while the lowest stays
  // buried at y - 0.053, under a floor strip that now tops out at y - 0.012:
  // nothing floats and nothing steps. All of that is replayed through the
  // vendored Matrix4 by tools/probe-walkway-paving.mjs, which fails if any of
  // it stops being true.
  //
  // NOT roughness. M.headstone is a MeshLambertMaterial and r161's Lambert has
  // no roughness property at all, so the `if ('roughness' in wetStone)` that
  // used to stand here never assigned anything in any build — the wet sheen it
  // asked for has never once existed. Deleted rather than left looking like it
  // works.
  const FLAG = 0.62;                 // target stone, both ways
  const JOINT = 0.055;               // the dark line between stones
  const VERGE = 0.30;                // the broken kerb on either shoulder
  const WALKWAY_TIERS = [1, 0.88, 0.76];
  const wetTiers = WALKWAY_TIERS.map((value, i) => {
    const mat = M.headstone.clone();
    mat.userData.underfalls = true;  // cave visibility keeps tagged materials
    mat.name = `underfalls wet walkway flags tier ${i + 1} of ${WALKWAY_TIERS.length}`;
    mat.color.setHex(0xbcc8ca).multiplyScalar(value);
    if ('emissive' in mat) {
      mat.emissive = new THREE.Color(0x394548).multiplyScalar(value);
      mat.emissiveIntensity = 0.72;
    }
    return mat;
  });
  const vergeStone = M.headstone.clone();
  vergeStone.userData.underfalls = true;
  vergeStone.name = 'underfalls wet walkway verge';
  vergeStone.color.setHex(0xbcc8ca).multiplyScalar(0.52);
  if ('emissive' in vergeStone) {
    vergeStone.emissive = new THREE.Color(0x394548).multiplyScalar(0.52);
    vergeStone.emissiveIntensity = 0.72;
  }
  {
    const paveRng = new RNG(0x57a1b0c9);   // tilt, lift, yaw — cosmetic only
    const tierRng = new RNG(0x2f6d13a7);   // which value course a stone joins
    const flagMatrices = WALKWAY_TIERS.map(() => []);
    const vergeMatrices = [];
    let course = 0;
    for (const seg of layout.mainSegments) {
      const n = Math.max(2, Math.ceil(seg.length / 0.9));
      const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
      const nx = tz, nz = -tx;
      const yaw = Math.atan2(seg.dx, seg.dz);
      const pitch = seg.length / n;
      const depth = pitch - JOINT;         // was pitch + 61 mm: an overlap
      for (let i = 0; i < n; i++, course++) {
        const t = (i + 0.5) / n;
        const x = lerp(seg.a.x, seg.b.x, t);
        const y = lerp(seg.a.y, seg.b.y, t);
        const z = lerp(seg.a.z, seg.b.z, t);
        const w = lerp(seg.a.w, seg.b.w, t);
        const half = clamp(w * 0.46, 0.94, 1.72);   // the ribbon's own half-width
        const cols = Math.max(3, Math.round((half * 2) / FLAG));
        const cell = (half * 2) / cols;
        const width = cell - JOINT;
        const shift = (course & 1) ? cell * 0.25 : -cell * 0.25;
        for (let c = 0; c < cols; c++) {
          const off = -half + (c + 0.5) * cell;
          // Value by distance from the centre line, dithered by up to half
          // a tier so it reads as a quarry and not as three painted stripes.
          const tier = clamp(Math.floor(
            (Math.abs(off) / half) * WALKWAY_TIERS.length + tierRng.range(-0.45, 0.45)),
            0, WALKWAY_TIERS.length - 1);
          const thick = 0.066 + paveRng.range(0, 0.012);
          flagMatrices[tier].push(transformMatrix(
            x + nx * (off + shift),
            y + 0.042 + paveRng.range(-0.006, 0.006) - thick * 0.5,
            z + nz * (off + shift),
            paveRng.range(-0.024, 0.024),
            yaw + paveRng.range(-0.03, 0.03),
            paveRng.range(-0.024, 0.024),
            width, thick, depth));
        }
        for (const side of [1, -1]) {
          // The kerb takes the course's shift too. Without it the outer flag
          // drives into the verge on every second row while the far shoulder
          // opens a gap the width of the stagger.
          const edge = side * (half + JOINT + VERGE * 0.5) + shift;
          vergeMatrices.push(transformMatrix(
            x + nx * edge,
            y - 0.005 + paveRng.range(-0.008, 0.008),   // nominal top 12 mm low
            z + nz * edge,
            paveRng.range(-0.05, 0.05),
            yaw + paveRng.range(-0.09, 0.09),
            paveRng.range(-0.05, 0.05),
            VERGE, 0.07, depth));
        }
      }
    }
    const flagGeo = new THREE.BoxGeometry(1, 1, 1);
    WALKWAY_TIERS.forEach((_, i) => {
      const mesh = addInstances(game.scene, flagGeo, wetTiers[i], flagMatrices[i], {
        name: `underfalls wet walkway flags tier ${i + 1} of ${WALKWAY_TIERS.length}`,
        receiveShadow: true,
      });
      if (mesh) mesh.userData.underfalls = true;
    });
    const verge = addInstances(game.scene, flagGeo, vergeStone, vergeMatrices,
      { name: 'underfalls wet walkway verge', receiveShadow: true });
    if (verge) verge.userData.underfalls = true;
  }

  // Chamber floors are broad and honest. Each used to be one big SQUARE slab
  // at r*1.72 while the walkable clamp is a DISC of radius r: at the chapel
  // that meant over two metres of visible floor you could not walk on at the
  // corners, and rim gaps of invisible floor at the edge midpoints — "random
  // things" in floor form. One instanced sixteen-gon disc per chamber now
  // matches the clamp within 2%. The disc is the TOP of a deliberate z-ladder:
  // it tops out at chamber.y, the corridor strips 12 mm under it and the hatch
  // cistern square 24 mm under that. It did not used to be — all three sat at
  // exactly chamber.y, sharing a plane bit-for-bit wherever a route crossed a
  // chamber, which is the same z-fight class as the ossuary deck (515ebef).
  {
    const discGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
    const discs = new THREE.InstancedMesh(discGeo, M.rock, layout.chambers.length);
    const m4 = new THREE.Matrix4();
    const q0 = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    layout.chambers.forEach((chamber, i) => {
      m4.compose(
        new THREE.Vector3(chamber.x, chamber.y - 0.14, chamber.z),
        q0, sc.set(chamber.r * 1.02, 0.28, chamber.r * 1.02));
      discs.setMatrixAt(i, m4);
    });
    discs.instanceMatrix.needsUpdate = true;
    discs.receiveShadow = true;
    discs.name = 'underfalls chamber floor discs';
    discs.userData.underfalls = true;
    discs.frustumCulled = false;   // unit-geometry bounds sit at the origin
    game.scene.add(discs);
  }
  for (const chamber of layout.chambers) {
    // The atmosphere layer adds an irregular low-poly vault for appearance;
    // this square backing is the light-tight structural shell beneath it. Its
    // overlap reaches beyond the wall ring, so no camera angle can expose the
    // outdoor dome through the cap's former annulus.
    const backingY = chamber.name === 'drowned pump chapel' ? 6.08 : 5.68;
    world.box(M.rock, chamber.x, chamber.y + backingY, chamber.z,
      chamber.r * 2 + 2.5, 0.52, chamber.r * 2 + 2.5);
    chamberCaps++;
  }
  layout.shell = { routeRoofs, chamberCaps };

  // ---- wayfinding tier -----------------------------------------------------
  // Alex's "rocks and random things" is a hierarchy problem: nothing in the
  // district said THIS way. Three additions, all pale (value, not hue), all
  // instanced, none collidable.
  const paleMark = M.headstone.clone();
  paleMark.color.setHex(0xc8d1d2);
  if ('emissive' in paleMark) {
    paleMark.emissive = new THREE.Color(0x3a4547);
    paleMark.emissiveIntensity = 0.58;
  }

  // 1. A pale stalagmite marker on the OUTSIDE of every hard turn (>45°), so
  //    the route's four real decisions each own a landmark. The 135° hairpin
  //    at the east ambulatory — the darkest, most-missed turn in the district
  //    — gets the tallest.
  {
    const marks = [];
    // The cone's base radius, shared by the seating test below and the drawn
    // geometry, so the two can never drift apart. The cone is WIDEST at the
    // floor and the player capsule stands on that floor, so this -- not the
    // narrower slice at EYE -- is the footprint that has to clear the lane.
    const markR = 0.34;
    const main = layout.main;
    for (let i = 1; i < main.length - 1; i++) {
      const a = main[i - 1], b = main[i], c = main[i + 1];
      const inD = new THREE.Vector2(b.x - a.x, b.z - a.z).normalize();
      const outD = new THREE.Vector2(c.x - b.x, c.z - b.z).normalize();
      const turn = Math.acos(clamp(inD.dot(outD), -1, 1)) * 180 / Math.PI;
      if (turn < 45) continue;
      // outside-of-turn bisector: away from where the route bends
      const bis = new THREE.Vector2(inD.x - outD.x, inD.y - outD.y);
      if (bis.lengthSq() < 1e-6) continue;
      bis.normalize();
      // THE MARKER IS OFFSET AGAINST THIS NODE'S OWN w, BUT THE FLOOR IT
      // STANDS ON IS THE UNION'S. Both chapel-aisle nodes carry w 4.75 while
      // the chapel disc reaches 10.50, so b.w + 1.1 planted two pale cones on
      // open chapel floor. The east one's axis sat 0.187 m INSIDE the walkable
      // union and the nearest pose the clamp will hold was 0.337 m inside the
      // cone: you stand in it. The west one's axis was 0.158 m OUTSIDE the
      // disc and still failed, because a cone has a radius -- its 0.34 m base
      // overlapped a legal stand by 0.161 m. So seat outward against the union
      // until the whole base circle clears UNDERFALLS_SOLID_PAD.
      //
      // Measured (tools/probe-wayfinding-tier.mjs), distance from the drawn
      // cone to the nearest pose the clamp holds, head bob included:
      //   pump approach      off 5.70 (+0.00)    0.783 ->  0.783 m
      //   chapel west aisle  off 6.63 (+0.78)   -0.161 ->  0.449 m
      //   chapel east aisle  off 6.97 (+1.12)   -0.337 ->  0.451 m
      //   east ambulatory    off 4.10 (+0.00)    0.791 ->  0.791 m
      // Nothing dropped: all four turns keep their landmark. Both new seats
      // land 11.27 m from the chapel centre, inside the 11.75 m half-extent
      // of that chamber's structural cap, and the two cones are 4.28 m and
      // 4.45 m against a cap underside at 5.82 m -- so moving them outward
      // pokes nothing through the shell. What it does do is stand them at
      // the chapel WALL rather than on the chapel FLOOR, which is what
      // "outside of the turn" was supposed to mean in the first place.
      const base = b.w + 1.1;
      let off = base, seated = false;
      // 1.5 m is the whole budget. Past that the cone is marking the far side
      // of a different room rather than this turn. Deepest seat needed: 1.12.
      for (let push = 0; push <= 1.5 + 1e-9; push += 0.02) {
        off = base + push;
        const mx = b.x + bis.x * off, mz = b.z + bis.y * off;
        let worst = Infinity;
        for (let k = 0; k < 8; k++) {
          const th = k * Math.PI / 4;
          const hit = projectUnderfalls(layout,
            mx + Math.cos(th) * markR, mz + Math.sin(th) * markR);
          if (hit && hit.clearance < worst) worst = hit.clearance;
        }
        const axis = projectUnderfalls(layout, mx, mz);
        if (axis && axis.clearance < worst) worst = axis.clearance;
        if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
      }
      // A marker that cannot get out of the lane is a rock in the road. The
      // turn would keep its geometry and lose its landmark -- never gain an
      // obstacle. No turn needs this today; the branch is the guarantee.
      if (!seated) continue;
      const mark = {
        x: b.x + bis.x * off, y: b.y, z: b.z + bis.y * off,
        h: 4.2 + Math.min(1.0, (turn - 45) / 90),
      };
      marks.push(mark);
      // ON THE LEDGER AS A CIRCLE. Round thirteen's ledger stored only
      // rectangles, so these cones were left off it with a note saying a
      // 0.34 m cone squared into a rect invents 0.481 m of corner it does
      // not have -- true, and the reason two of them then stood in open
      // chapel floor with no gate able to say so. publishSolid carries {r}
      // now, so the cone is measured as the cone it is. The base radius is
      // the widest slice and the player stands on the same floor it does,
      // so markR is the whole footprint.
      publishSolid(layout, {
        name: 'underfalls turn marker', guard: 'clamp',
        y0: mark.y, y1: mark.y + mark.h,
        x: mark.x, z: mark.z, r: markR,
      });
    }
    if (marks.length) {
      const geo = new THREE.ConeGeometry(markR, 1, 6);
      geo.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(geo, paleMark, marks.length);
      const m4 = new THREE.Matrix4();
      const q0 = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      marks.forEach((p, i) => {
        m4.compose(new THREE.Vector3(p.x, p.y, p.z), q0, sc.set(1, p.h, 1));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = 'underfalls turn markers';
      mesh.userData.underfalls = true;
      mesh.frustumCulled = false;
      game.scene.add(mesh);
    }
  }

  // 2. Paired pale jambs at every chamber rim crossing that can honestly
  //    carry them, so entering and leaving a room reads as an event. Three
  //    of the four chambers on the main route can; the drowned pump chapel
  //    cannot, and the comment on the seating loop says why.
  {
    const jambs = [];
    for (const seg of layout.mainSegments) {
      for (const chamber of layout.chambers) {
        // segment param t where |seg(t) - centre| = r
        const fx = seg.a.x - chamber.x, fz = seg.a.z - chamber.z;
        const A = seg.dx * seg.dx + seg.dz * seg.dz;
        const Bq = 2 * (fx * seg.dx + fz * seg.dz);
        const Cq = fx * fx + fz * fz - chamber.r * chamber.r;
        const disc = Bq * Bq - 4 * A * Cq;
        if (disc <= 0) continue;
        const sq = Math.sqrt(disc);
        for (const t of [(-Bq - sq) / (2 * A), (-Bq + sq) / (2 * A)]) {
          if (t <= 0.02 || t >= 0.98) continue;
          const x = seg.a.x + seg.dx * t, z = seg.a.z + seg.dz * t;
          const y = lerp(seg.a.y, seg.b.y, t);
          const w = lerp(seg.a.w, seg.b.w, t);
          const nx = seg.dz / seg.length, nz = -seg.dx / seg.length;
          // THE SAME BUG AS THE SLUICE GATE, ONE FUNCTION AWAY: the jamb is
          // offset against the SEGMENT's w, but at a chamber rim the floor
          // underneath is the chamber DISC. Three of the fourteen jambs stood
          // on walkable floor -- (20.338, 44.972) union clearance -1.320,
          // (29.480, 48.925) -1.461, (35.209, 55.472) -2.532, that last one
          // 2.53 m inside main#6, a corridor its own crossing has nothing to
          // do with. For all three the nearest pose the clamp will hold was
          // 0.000 m away: you stand inside a pale post, and being the
          // brightest thing in the district it is the one you walk at.
          // The other eleven cleared by only 0.357..0.396 m: every one under
          // the pad, though none of those eleven reached the 0.24 m at which
          // the near plane eats a face outright. Only the three did.
          //
          // Seat outward until the whole footprint clears the pad. The ten
          // survivors need 0.08..0.10 m of push and end 0.442..0.465 m from
          // the nearest legal stand -- measured twice, by
          // tools/probe-wayfinding-tier.mjs (a model of this loop) and by
          // tools/verify-wayfinding-tier.mjs (which executes this loop's own
          // source text and reads the instance matrices back).
          //
          // DROPPED: both drowned-pump-chapel crossings, all four jambs.
          // Their offsets would have to pass 2.4 m to escape, because the
          // chapel rim is not a pinch -- the corridor just widens into the
          // room, and there is no doorway there to frame. A doorway is a
          // PAIR, so a crossing is all-or-nothing exactly the way the sluice
          // gate drops posts, lintel and tooth bar together: one lone pale
          // post beside the route IS the "rocks and random things" this tier
          // exists to stop being. Ten jambs, and the intake apse, overflow
          // gallery and hatch cistern still get their doorways; the chapel
          // is announced by the pale cone on its turn instead.
          const pair = [];
          for (const side of [-1, 1]) {
            const base = w + 0.55;
            let off = base, seated = false;
            // 0.6 m -- two post widths -- is the budget. Further out it is no
            // longer framing this doorway, it is a stone standing near one.
            for (let push = 0; push <= 0.6 + 1e-9; push += 0.02) {
              off = base + push;
              const jx = x + nx * side * off, jz = z + nz * side * off;
              // The instance is composed with an identity quaternion, so the
              // 0.3 x 0.3 post is WORLD-axis-aligned however the segment runs.
              // Sample its real square; a turned one understates the corners.
              let worst = Infinity;
              for (const u of [-0.15, 0, 0.15]) {
                for (const v of [-0.15, 0, 0.15]) {
                  const hit = projectUnderfalls(layout, jx + u, jz + v);
                  if (hit && hit.clearance < worst) worst = hit.clearance;
                }
              }
              if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
            }
            if (!seated) { pair.length = 0; break; }
            pair.push({ x: x + nx * side * off, y, z: z + nz * side * off });
          }
          jambs.push(...pair);
          // AND PUT THEM ON THE LEDGER. layout.solids is what
          // tests/underfalls-expansion.mjs walks when it asks whether any
          // pose the clamp accepts stands inside a drawn face. Nothing in
          // this district is a collider, so a fixture missing from that
          // ledger is a fixture no gate can see -- which is exactly how
          // three jambs survived round thirteen standing on open floor
          // while the flank walls and gate posts beside them got fixed.
          // The post is composed with an identity quaternion, so its face
          // IS world-axis-aligned: nx/tx are the world axes and 0.15 is the
          // exact half-extent, not an AABB's overstatement.
          // The cones on the turns are on it too now, as circles: the ledger
          // carries {r} as well as a rect, so nothing has to be squared off
          // into corners it does not have to be measured.
          // tools/verify-wayfinding-tier.mjs is the second opinion on both.
          for (const p of pair) {
            publishSolid(layout, {
              name: 'underfalls chamber doorjamb', guard: 'clamp',
              y0: p.y, y1: p.y + 2.6,
              x: p.x, z: p.z, nx: 1, nz: 0, tx: 0, tz: 1,
              halfN: 0.15, halfT: 0.15,
            });
          }
        }
      }
    }
    if (jambs.length) {
      const geo = new THREE.BoxGeometry(0.3, 1, 0.3);
      geo.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(geo, paleMark, jambs.length);
      const m4 = new THREE.Matrix4();
      const q0 = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      jambs.forEach((p, i) => {
        m4.compose(new THREE.Vector3(p.x, p.y, p.z), q0, sc.set(1, 2.6, 1));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = 'underfalls chamber doorjambs';
      mesh.userData.underfalls = true;
      mesh.frustumCulled = false;
      game.scene.add(mesh);
    }
  }

  // 3. The fork reads without moving a node: the wet ribbon already runs only
  //    the main way, and the optional culvert now wears a dry, DARK lintel
  //    low across its mouth — clearly a place, clearly not the way onward.
  {
    const mouth = layout.secret[0];
    const next = layout.secret[1];
    if (mouth && next) {
      const yaw = Math.atan2(next.x - mouth.x, next.z - mouth.z);
      const dryDark = M.rock.clone();
      dryDark.userData.underfalls = true;
      dryDark.color.multiplyScalar(0.42);
      world.box(dryDark, mouth.x, mouth.y + 2.24, mouth.z, 3.1, 0.34, 0.5, yaw);
      // Overhead by design -- its underside is 2.07, which is 0.45 m over the
      // eye -- and on the ledger anyway, for the same reason as the sluice
      // gate's iron: over HEAD is not the same as out of the near plane.
      publishSolid(layout, {
        name: 'culvert mouth lintel', guard: 'clamp',
        y0: mouth.y + 2.07, y1: mouth.y + 2.41,
        x: mouth.x, z: mouth.z,
        nx: Math.sin(yaw), nz: Math.cos(yaw),
        tx: Math.cos(yaw), tz: -Math.sin(yaw),
        halfN: 0.25, halfT: 1.55,
      });
    }
  }
}

function addColliderCylinder(world, x, z, r, y0, y1, role) {
  return world.addCollider(x - r, y0, z - r, x + r, y1, z + r,
    { underfalls: true, role });
}

// THE LEDGER OF DRAWN FACES. Everything this district draws that stands in
// the player's HEAD WINDOW is published here, and
// tests/underfalls-expansion.mjs walks it to ask the only question that has
// ever mattered in the Underfalls: can a pose the player can actually hold
// stand inside a drawn face, or close enough that the 0.2 near plane deletes
// it. A fixture missing from this list is a fixture no gate can see -- which
// is exactly how three doorjambs, two turn markers, the keepsake shelf, the
// fallen bell and six benches all survived round thirteen standing in open
// floor while the flank walls and gate posts beside them got fixed.
//
// THE HEAD WINDOW IS THE PLAYER'S OWN TWO COLLIDER TESTS, QUOTED
// (player.js _moveAxis): a body reaching no higher than feet + STEP_UP (0.5)
// is a step you walk over, and one starting above feet + HEAD (1.75) is
// something you walk under. Only what crosses that band can be a wall you
// walk through. y0/y1 are WORLD y, because this district's floor runs 0.00
// to 3.20 and a bare 0.5 would call the bell cistern's keepsake shelf
// overhead.
//
// `guard` names what holds the player off the face, because the two guards
// have two different numbers and pretending otherwise fails honest geometry:
//   'clamp'  -- nothing but the district clamp. installClamp stably permits
//               clearance -0.04, so the distance owed is the player's RADIUS
//               0.34 plus that 0.08 dead band: UNDERFALLS_SOLID_PAD.
//   a role   -- a world collider carrying that role stands in front of it.
//               _moveAxis puts the player's centre exactly RADIUS from the
//               AABB with no dead band at all, so the distance owed is
//               RADIUS. The gate proves the named collider exists rather
//               than taking the word for it.
// Both numbers are comfortably past the 0.24 at which the near plane starts
// eating faces, so the flat XZ gap is the whole test.
//
// FACES, NOT AABBs. A rect entry is the drawn face in its own frame
// (nx/nz is the normal axis paired with halfN); a disc entry is {r}. main#7
// yaws 35.5 degrees and a rotated 0.54 x 0.95 box has a 0.99 m AABB, 0.22 m
// fatter into the lane than the box -- believing that number is the old
// forest trap, and squaring off a 0.34 m cone into a rect invents 0.481 m of
// corner it does not have.
function publishSolid(layout, entry) {
  (layout.solids || (layout.solids = [])).push(entry);
  return entry;
}

function markUnderfalls(object) {
  object.userData.underfalls = true;
  return object;
}

function transformMatrix(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const position = new THREE.Vector3(x, y, z);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  return new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(sx, sy, sz));
}

function addInstances(parent, geometry, material, matrices, {
  name = '', castShadow = false, receiveShadow = false,
} = {}) {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.name = name;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function buildRouteLights(game, layout, state) {
  const lights = [
    [layout.entrance.x + 0.8, 2.45, layout.entrance.z + 3.2, 0x7f9ca5, 13.5, 20],
    [layout.named['intake apse'].x, 2.75, layout.named['intake apse'].z, 0x91b2b8, 18, 22],
    [layout.named['pump approach'].x, 2.55, layout.named['pump approach'].z, 0x64777e, 9.5, 18],
  ];
  for (const [x, y, z, color, intensity, distance] of lights) {
    const light = markUnderfalls(new THREE.PointLight(color, intensity, distance, 1.15));
    light.position.set(x, y, z);
    game.scene.add(light);
    state.lights.push(light);
  }
}

function buildPumpChapel(game, layout, state) {
  const { scene, world, mats: M } = game;
  const C = layout.chapel;
  const group = new THREE.Group();
  group.name = 'drowned pump chapel';
  markUnderfalls(group);
  scene.add(group);

  const wetStone = M.stone.clone();
  wetStone.color.multiplyScalar(0.72);
  if ('roughness' in wetStone) wetStone.roughness = 0.74;
  const iron = M.metal.clone();
  iron.color.setHex(0x2c3d44);
  if ('roughness' in iron) iron.roughness = 0.54;
  if ('emissive' in iron) {
    iron.emissive.setHex(0x071216);
    iron.emissiveIntensity = 0.34;
  }
  const pale = M.headstone.clone();
  pale.color.multiplyScalar(0.74);
  const blackWater = M.water.clone();
  blackWater.color.setHex(0x152c35);
  blackWater.transparent = true;
  blackWater.opacity = 0.72;
  blackWater.depthWrite = false;
  if ('emissive' in blackWater) {
    blackWater.emissive.setHex(0x102f39);
    blackWater.emissiveIntensity = 0.42;
  }

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // A nave made from flood-control architecture: paired pillars, broken
  // pointed ribs, and a central aisle whose water flows toward the player.
  const aisleWest = layout.named['chapel west aisle'];
  const aisleEast = layout.named['chapel east aisle'];
  const aisleYaw = Math.atan2(aisleEast.x - aisleWest.x, aisleEast.z - aisleWest.z);
  const tx = Math.sin(aisleYaw), tz = Math.cos(aisleYaw);
  const nx = tz, nz = -tx;
  const pillarMatrices = [];
  const ribMatrices = [];
  for (let row = -2; row <= 2; row++) {
    const along = row * 3.25;
    const cx = C.x + tx * along, cz = C.z + tz * along;
    for (const side of [-1, 1]) {
      const x = cx + nx * side * 5.55, z = cz + nz * side * 5.55;
      const routeDistance = Math.min(...layout.segments.map((seg) => segmentProjection(seg, x, z).d));
      if (routeDistance < 1.28) continue;
      const h = 3.7 + (row & 1 ? 0.35 : 0);
      pillarMatrices.push(transformMatrix(x, h * 0.5, z,
        side * 0.025, row * 0.13, side * 0.035, 1, h, 1));
      // THE BOX AND THE DRAWING HAVE TO BE THE SAME WIDTH -- AND HERE IT IS
      // THE DRAWING THAT MOVES. The pillar was a seven-sided cone 0.63 wide
      // at the floor against a 0.54 box, so the drawn stone stood 0.09 m
      // proud of its own stop. Measured against every pose that collider
      // permits, the nearest drawn face was 0.314 m from the camera: past the
      // near plane, so never clipped, but inside the player's own 0.34 m body
      // radius. The stone was in you.
      //
      // MOVING THE BOX WOULD HAVE BEEN THE OTHER ANSWER, AND THE NUMBERS
      // REFUSE IT. enemies.js sweeps the Choir's 0.42 m footprint against every
      // AABB GROWN BY THAT RADIUS -- a Minkowski box, corners included, not a
      // rounded capsule -- and at 0.63 these boxes close two chords the
      // corridor union still allows: chapel east aisle -> dry return, and a
      // second pillar taking chapel west aisle -> east ambulatory. The nave is
      // where every chapel chord has to thread, and there is no room here.
      // (The bell cistern one room over went the opposite way for the opposite
      // reason -- the bell hangs, so its box came IN, to half 0.62 -- and it is
      // the height of the iron, not its width, that settles that one.)
      // So the flare comes in to 0.54 instead (see the geometry below):
      // the base is the box and the box is the base, the camera stops 0.32 m
      // from drawn stone, and not one navigation edge moves.
      addColliderCylinder(world, x, z, 0.54, -0.5, 3.2, 'pump chapel pillar');
      publishSolid(layout, {
        name: 'pump nave pillar', guard: 'pump chapel pillar',
        y0: -0.05, y1: h + 0.05, x, z, r: 0.54,
      });
      ribMatrices.push(transformMatrix(
        x - nx * side * 1.35, h + 0.25, z - nz * side * 1.35,
        0, aisleYaw, side * 0.75, 1, 4.5 * (row === 1 ? 0.72 : 1), 1));
    }
  }
  // 0.54 at the base, not 0.63: the collider above is a 0.54 half-extent box
  // and a drawn silhouette wider than its own stop is a silhouette you stand
  // inside. Nine centimetres off the flare of a 3.7 m column.
  addInstances(group, new THREE.CylinderGeometry(0.45, 0.54, 1, 7), wetStone, pillarMatrices,
    { name: 'pump nave pillars', castShadow: true, receiveShadow: true });
  addInstances(group, new THREE.CylinderGeometry(0.10, 0.17, 1, 6), wetStone, ribMatrices,
    { name: 'pump nave broken ribs', castShadow: true, receiveShadow: true });

  // The drowned aisle is shallow visual water over solid floor: eerie, never a
  // movement tax and never a disguised plunge.
  const aisle = add(new THREE.PlaneGeometry(2.4, 18.5), blackWater,
    C.x, 0.035, C.z, -Math.PI / 2, 0, aisleYaw);
  aisle.name = 'pump chapel reverse-flow aisle';

  // Pump-as-altar, safely outside both through-lines. The flywheel turns
  // backwards, a piston rises when it should fall, and empty benches face it.
  // The machinery lives in the dry southeast quadrant, clear of both the
  // diagonal public aisle and the north-south secret culvert.
  const altarX = C.x + 6.05, altarZ = C.z - 4.15;
  add(new THREE.CylinderGeometry(1.25, 1.55, 0.72, 8), wetStone, altarX, 0.36, altarZ);
  // This box has to stop the camera short of the FLYWHEEL, not just the drum.
  // The wheel's iron reaches 1.52 m from this axis (ring 1.38 + tube 0.14), and
  // its plane is fixed: the spin below is rotation.z about the torus's OWN axis,
  // so the silhouette never changes shape, only the world ZY circle it draws. At
  // half 1.28 the closest pose the clamp will hold put the camera 0.100 m from
  // that iron -- inside the 0.2 near plane, so the landmark was CLIPPED AWAY and
  // you looked straight through the impossible wheel. The player's own 0.34 m
  // radius already covers all of THE ONE PAD except the clamp's 0.08 dead band,
  // so the box only has to stand 1.52 + 0.08 clear. 1.62 rather than 1.60
  // because 1.60 MEETS 0.420 exactly and this measures 0.440, and because 1.62
  // also swallows the drum's own 1.55 m base octagon -- the 1.28 box left 0.27 m
  // of drum standing in walkable floor.
  //
  // Widening was measured before it was chosen, because this box sits in a room
  // the player crosses and the Choir paths through (findUnderfallsRoute takes an
  // edgeAllowed hook and enemies.js sweeps a 0.42 m footprint through every
  // AABB). Across the whole navigation graph the SAME 9 of 91 line-of-sight
  // pairs are blocked at 1.28 and at 1.62 -- not one route chord is lost -- and
  // the floor reachable from the west aisle goes 388.8 -> 384.2 m2 with the east
  // aisle, the culvert mouth and the north transept all still reached.
  addColliderCylinder(world, altarX, altarZ, 1.62, -0.4, 1.1, 'pump altar');
  publishSolid(layout, {
    name: 'pump altar drum', guard: 'pump altar',
    y0: 0, y1: 0.72, x: altarX, z: altarZ, r: 1.55,
  });
  // The flywheel is a SLAB on the ledger, not a disc: wheel.rotation.y is
  // -PI/2, so the ring stands in the world ZY plane and its footprint is
  // 0.28 m of tube across x by 3.04 m of ring along z. A disc of radius 1.52
  // would claim 1.24 m of chapel floor on the x axis that has no iron in it.
  publishSolid(layout, {
    name: 'pump flywheel', guard: 'pump altar',
    y0: 1.55 - 1.52, y1: 1.55 + 1.52,
    x: altarX, z: altarZ, nx: 1, nz: 0, tx: 0, tz: 1, halfN: 0.14, halfT: 1.52,
  });
  const pump = new THREE.Group();
  pump.position.set(altarX, 1.55, altarZ);
  group.add(pump);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.14, 8, 24), iron);
  // Face the west-aisle reveal, rather than presenting the flywheel edge-on.
  // Its backwards rotation is a strong landmark only when the player can read
  // the whole impossible circle between the nave columns.
  wheel.rotation.y = -Math.PI / 2;
  pump.add(wheel);
  const spokeMatrices = [];
  for (let i = 0; i < 8; i++) {
    spokeMatrices.push(transformMatrix(0, 0, 0, 0, 0, i * TAU / 8, 1, 2.45, 1));
  }
  addInstances(wheel, new THREE.CylinderGeometry(0.035, 0.055, 1, 5), iron, spokeMatrices,
    { name: 'pump flywheel spokes' });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.55, 8), iron);
  hub.rotation.z = Math.PI / 2;
  pump.add(hub);
  const piston = add(new THREE.CylinderGeometry(0.22, 0.27, 2.5, 7), iron,
    altarX + tx * 1.85, 1.45, altarZ + tz * 1.85);
  const bellJar = add(new THREE.SphereGeometry(0.58, 12, 9, 0, TAU, 0, Math.PI * 0.64), pale,
    altarX + tx * 1.85, 2.86, altarZ + tz * 1.85, Math.PI);
  bellJar.scale.y = 1.32;
  // The piston stands 1.85 m out along the aisle -- outside the altar box at any
  // sane width -- and it had NO collider at all. Measured: the camera could stand
  // 0.257 m inside it, and it spans y -0.09..2.99 so it crosses eye height for
  // its whole stroke. Widening the altar cannot reach it: covering it with that
  // square box needs half 1.93, which costs 10.2 m2 of chapel floor against the
  // 0.4 this one costs, and STILL leaves the piston short of the pad at 0.335 m.
  // It gets its own collider instead.
  //
  // It only ever moves in y (the ticker drives 1.45 +/- 0.29), so a fixed
  // footprint holds. -0.4..3.0 covers the whole stroke, is far too tall to be a
  // walkable step (STEP_UP 0.5) and starts far below head height (HEAD 1.75).
  // Half 0.38 rather than the drawn 0.27 because addColliderCylinder builds a
  // SQUARE box and the stop that matters is the face, not the corner:
  // 0.38 + the player's 0.34, less the head bob's 0.02 of world X, leaves 0.430
  // of air. Measured cost: 0.4 m2 of chapel floor and not one navigation edge.
  addColliderCylinder(world, altarX + tx * 1.85, altarZ + tz * 1.85, 0.38, -0.4, 3.0,
    'pump piston');
  publishSolid(layout, {
    name: 'pump piston', guard: 'pump piston',
    y0: 0.2, y1: 2.7,
    x: altarX + tx * 1.85, z: altarZ + tz * 1.85, r: 0.27,
  });
  // NOT ON THE LEDGER, DELIBERATELY, AND THE NUMBERS THAT SAY WHY:
  //   the bell jar over the piston  world 2.094..3.186, and the chapel floor
  //     is y 0, so it starts 0.34 m above HEAD everywhere it can be reached.
  //   the broken nave ribs          world 2.203..6.005. Only a pose on the
  //     neighbouring elevated corridor (feet 0.59) brings their lower ends
  //     into the window at all, and there the nearest drawn face is 0.597 m
  //     from the pose and 0.626 m from the camera -- clear of the pad.
  //   the empty benches and their legs   0.309..0.491 and -0.137..0.397 over
  //     a floor of 0, both wholly under STEP_UP. See the comment on the seat
  //     thickness below: that is what it is for.
  //   the drowned aisle water plane      y 0.035, floor dressing.
  // (tools/probe-cistern-shelf.mjs measures every one of them.)

  const benchMatrices = [];
  const legMatrices = [];
  const BENCH_SEAT = 0.10;   // plank thickness; see the seat comment below
  for (let row = -2; row <= 1; row++) {
    const along = row * 3.0 + 0.8;
    for (const side of [-1, 1]) {
      const x = C.x + tx * along + nx * side * 3.55;
      const z = C.z + tz * along + nz * side * 3.55;
      const routeDistance = Math.min(...layout.segments.map((seg) => segmentProjection(seg, x, z).d));
      if (routeDistance < 1.18) continue;
      // "ORDINARY STEP-HEIGHT CLUTTER" IS A CLAIM WITH A NUMBER IN IT, AND
      // THIS ONE MISSED BY 0.111 m. The seat was an 0.18 m plank centred at
      // 0.48 and tilted 0.035 rad over 2.35 m, so it topped out at 0.611 --
      // above STEP_UP (0.5), which is precisely where player.js stops calling
      // a body walkable and starts calling it a wall. Six of them stood on
      // open chapel floor with no collider, and measured against every pose
      // the clamp holds the nearest drawn face was 0.001 m away: you stand
      // in the bench. Same sentence as his screenshots -- a thing that is
      // drawn and is not there.
      //
      // A collider is the wrong answer here and the numbers say so: these are
      // yawed 63.4 degrees, and a 2.35 x 0.58 seat squares off into a
      // 2.36 x 1.57 AABB -- 2.7x its own footprint of invisible wall, six
      // times over, in the one room the player crosses diagonally and the
      // Choir paths through. So the plank gets thinner instead: 0.10 m at
      // 0.40 tops out at 0.491, nine millimetres under STEP_UP, with the
      // seating surface still at 0.45 where a bench belongs. The engine's own
      // rule now classes it the way this comment always claimed, and the
      // camera at EYE stays 1.009 m above it, four times the near plane.
      // The legs are re-expressed against BENCH_SEAT so they stay put in
      // world units: their local offsets are divided by the seat scale.
      const benchMatrix = transformMatrix(x, 0.40, z,
        0, aisleYaw + (side < 0 ? Math.PI : 0), side * 0.035, 2.35, BENCH_SEAT, 0.58);
      benchMatrices.push(benchMatrix);
      // Thin crooked legs make them read as furniture while remaining ordinary
      // step-height clutter, never another invisible wall.
      for (const d of [-0.78, 0.78]) {
        const local = transformMatrix(d / 2.35, -0.27 / BENCH_SEAT, 0, 0, 0, 0,
          0.12 / 2.35, 0.48 / BENCH_SEAT, 0.12 / 0.58);
        legMatrices.push(benchMatrix.clone().multiply(local));
      }
    }
  }
  addInstances(group, new THREE.BoxGeometry(1, 1, 1), M.woodDark, benchMatrices,
    { name: 'empty pump benches', castShadow: true, receiveShadow: true });
  addInstances(group, new THREE.BoxGeometry(1, 1, 1), M.woodDark, legMatrices,
    { name: 'crooked bench legs', castShadow: true, receiveShadow: true });

  // The building was occupied after it flooded: candles were placed on the
  // pump, but every seat points at the machinery rather than an altar.
  for (let i = -3; i <= 3; i++) {
    world.candles.push({
      x: C.x + tx * i * 2.0 + nx * (i & 1 ? 4.7 : -4.7),
      y: 0.62,
      z: C.z + tz * i * 2.0 + nz * (i & 1 ? 4.7 : -4.7),
      intensity: 0.78 + (i === 0 ? 0.55 : 0), r: 3.3,
    });
  }
  world.candles.push({ x: altarX, y: 1.05, z: altarZ, intensity: 1.6, r: 5.2 });

  const light = new THREE.PointLight(0xa8ccd4, 32.5, 26, 1.15);
  markUnderfalls(light);
  light.position.set(altarX, 2.5, altarZ);
  scene.add(light);
  state.lights.push(light);
  const naveLight = new THREE.PointLight(0x718c96, 13, 24, 1.15);
  markUnderfalls(naveLight);
  naveLight.position.set(C.x, C.y + 3.25, C.z);
  scene.add(naveLight);
  state.lights.push(naveLight);
  state.pump = {
    group, wheel, piston, bellJar, light, naveLight,
    position: new THREE.Vector3(altarX, 1.3, altarZ), kick: 0,
  };
}

function buildSluice(game, layout, state) {
  const { scene, world, mats: M } = game;
  const group = new THREE.Group();
  group.name = 'vertical sluice gallery';
  markUnderfalls(group);
  scene.add(group);
  const iron = M.metal.clone();
  iron.color.setHex(0x26343b);
  if ('emissive' in iron) {
    iron.emissive.setHex(0x050b0e);
    iron.emissiveIntensity = 0.3;
  }
  const water = M.water.clone();
  water.color.setHex(0x7597a3);
  water.transparent = true;
  water.opacity = 0.52;
  water.depthWrite = false;
  if ('emissive' in water) {
    water.emissive.setHex(0x345761);
    water.emissiveIntensity = 0.72;
  }
  const wetStone = M.rock.clone();
  wetStone.color.multiplyScalar(0.78);

  const lowerIndex = layout.main.indexOf(layout.lowerSluice);
  const overflowIndex = layout.main.indexOf(layout.overflow);
  const climb = layout.main.slice(lowerIndex, overflowIndex + 1);
  const treads = sampleUnderfallsPath(climb, 1.05);
  const treadMatrices = [];
  for (const s of treads) {
    const next = climb[Math.min(climb.length - 1, s.segment + 1)];
    const prev = climb[Math.max(0, s.segment)];
    const yaw = Math.atan2(next.x - prev.x, next.z - prev.z);
    // Four stones across, not one plank. At s.w*1.65 (4.13–4.54 m) with
    // M.rock's repeat (2,2) one tread wore 2.06–2.27 m of stone per texture
    // tile across against 0.38 m along — a 5.4:1 to 6.0:1 smear, worse than the
    // ribbon's. Quartering brings the across axis to ~0.5 m a tile and matches
    // the paving next door. Same InstancedMesh, same draw call, 34 treads ->
    // 136 stones, and a 50 mm joint between them like the walkway's.
    const treadW = s.w * 1.65;
    for (let q = 0; q < 4; q++) {
      const off = -treadW / 2 + treadW * (q + 0.5) / 4;
      treadMatrices.push(transformMatrix(
        s.x + Math.cos(yaw) * off, s.y + 0.018, s.z - Math.sin(yaw) * off,
        0, yaw, 0, treadW / 4 - 0.05, 0.11, 0.76));
    }
  }
  addInstances(group, new THREE.BoxGeometry(1, 1, 1), wetStone, treadMatrices,
    { name: 'sluice climb treads', receiveShadow: true });

  // Water runs uphill in two narrow gutters beside the player. Motion and
  // brightness communicate the wrong direction without relying on hue.
  const runnels = [];
  for (let i = 0; i < climb.length - 1; i++) {
    const a = climb[i], b = climb[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const tx = dx / len, tz = dz / len, nx = tz, nz = -tx;
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(b.y - a.y, len);
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, len + 0.7, 1, 12), water);
      mesh.rotation.set(-Math.PI / 2 + pitch, 0, yaw);
      const w = (a.w + b.w) * 0.5;
      mesh.position.set((a.x + b.x) * 0.5 + nx * side * (w - 0.42),
        (a.y + b.y) * 0.5 + 0.08,
        (a.z + b.z) * 0.5 + nz * side * (w - 0.42));
      mesh.renderOrder = 2;
      group.add(mesh);
      runnels.push(mesh);
    }
  }

  // Repeating flood-gate ribs turn the elevation change into a vertical read.
  const postMatrices = [];
  const topMatrices = [];
  const toothMatrices = [];
  for (let localIndex = 0; localIndex < climb.length; localIndex++) {
    const p = climb[localIndex];
    const index = lowerIndex + localIndex;
    const prev = layout.main[Math.max(0, index - 1)];
    const next = layout.main[Math.min(layout.main.length - 1, index + 1)];
    const yaw = Math.atan2(next.x - prev.x, next.z - prev.z);
    const gateMatrix = transformMatrix(p.x, p.y, p.z, 0, yaw, 0);
    // THE GATE HAS TO STAND OUTSIDE THE LANE IT FRAMES, AND THE LANE AT A NODE
    // IS THE UNION'S WIDTH THERE, NOT THIS NODE'S OWN w. At the overflow
    // gallery the union is the 4.80 m chamber disc while p.w is 2.75, so both
    // posts stood at clearance -1.930, inner faces at -2.045: two full-height
    // iron posts nearly two metres inside the walkable floor, flanking the
    // only line out of the gallery. "some of these walls you basically are
    // forced to walk through to get there." At the other three nodes the post
    // face cleared the lane by 0.005 m — a fortieth of the near plane — so
    // brushing one deleted it. Measured distance from the nearest pose the
    // clamp will hold to the nearest post: 0 m before, 0.466 m after.
    const ax = Math.cos(yaw), az = -Math.sin(yaw);   // gateMatrix's local +X
    const bx = Math.sin(yaw), bz = Math.cos(yaw);    // and its local +Z
    let half = p.w + 0.12;
    let seated = false;
    for (; half <= p.w + 1.0 + 1e-9; half += 0.02) {
      let worst = Infinity;
      for (const side of [-1, 1]) {
        for (const u of [-0.115, 0.115]) {
          for (const v of [-0.14, 0.14]) {
            const hit = projectUnderfalls(layout,
              p.x + ax * side * (half + u) + bx * v,
              p.z + az * side * (half + u) + bz * v);
            if (hit && hit.clearance < worst) worst = hit.clearance;
          }
        }
      }
      if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
    }
    // A gate that has to be that wide is not a gate: the union has swallowed
    // the node. Its lintel would hang unattached across a room, which is the
    // bell's mistake one district over — so the whole fixture, posts, lintel
    // and tooth bar, sits this one out. Three gates on the climb, not four.
    if (!seated) continue;
    for (const side of [-1, 1]) {
      postMatrices.push(gateMatrix.clone().multiply(transformMatrix(
        side * half, 1.9, 0, 0, 0, 0, 0.23, 3.85, 0.28)));
      // The posts are the only part of the gate at body height: the lintel
      // sits at 3.72 and the tooth bar at 2.15 and up, both well clear of
      // HEAD (1.75), overhead by design. So the posts are what the pin reads.
      publishSolid(layout, {
        name: 'sluice gate post', guard: 'clamp',
        y0: p.y - 0.025, y1: p.y + 3.825,
        x: p.x + ax * side * half, z: p.z + az * side * half,
        nx: ax, nz: az, tx: bx, tz: bz, halfN: 0.115, halfT: 0.14,
      });
    }
    topMatrices.push(gateMatrix.clone().multiply(transformMatrix(
      0, 3.72, 0, 0, 0, 0, half * 2 + 0.34, 0.25, 0.36)));
    toothMatrices.push(gateMatrix.clone().multiply(transformMatrix(
      0, 2.15 + (index & 1) * 0.55, 0,
      0, 0, (index & 1 ? 1 : -1) * 0.05, p.w * 1.45, 0.11, 0.28)));
    // The lintel and the tooth bar go on the ledger too even though both are
    // over HEAD. "Overhead" only settles the body; the near plane does not
    // care which way is up, and the tooth bar is the lowest iron in this
    // district: 2.15 less half its 0.11 thickness and less the 0.05 rad tilt
    // over its own length, which puts its underside 0.385 m over the eye.
    const toothDrop = (p.w * 1.45 / 2) * Math.sin(0.05) + 0.055;
    publishSolid(layout, {
      name: 'sluice gate tooth bar', guard: 'clamp',
      y0: p.y + 2.15 + (index & 1) * 0.55 - toothDrop,
      y1: p.y + 2.15 + (index & 1) * 0.55 + toothDrop,
      x: p.x, z: p.z, nx: bx, nz: bz, tx: ax, tz: az,
      halfN: 0.14, halfT: p.w * 1.45 / 2,
    });
    publishSolid(layout, {
      name: 'sluice gate lintel', guard: 'clamp',
      y0: p.y + 3.595, y1: p.y + 3.845,
      x: p.x, z: p.z, nx: bx, nz: bz, tx: ax, tz: az,
      halfN: 0.18, halfT: half + 0.17,
    });
  }
  addInstances(group, new THREE.BoxGeometry(1, 1, 1), iron, postMatrices,
    { name: 'sluice gate posts', castShadow: true, receiveShadow: true });
  addInstances(group, new THREE.BoxGeometry(1, 1, 1), iron, topMatrices,
    { name: 'sluice gate lintels', castShadow: true, receiveShadow: true });
  addInstances(group, new THREE.BoxGeometry(1, 1, 1), iron, toothMatrices,
    { name: 'sluice gate teeth', castShadow: true, receiveShadow: true });

  const high = layout.overflow;
  const highLight = new THREE.PointLight(0xd6eef0, 23, 26, 1.15);
  markUnderfalls(highLight);
  highLight.position.set(high.x, high.y + 2.1, high.z);
  scene.add(highLight);
  state.lights.push(highLight);
  const midLight = new THREE.PointLight(0x9fbec4, 16, 22, 1.15);
  markUnderfalls(midLight);
  midLight.position.set(layout.upperSluice.x, layout.upperSluice.y + 2.15, layout.upperSluice.z);
  scene.add(midLight);
  state.lights.push(midLight);
  const lowerLight = new THREE.PointLight(0x8aa9b1, 15.5, 26, 1.15);
  markUnderfalls(lowerLight);
  lowerLight.position.set(layout.lowerSluice.x, layout.lowerSluice.y + 2.35, layout.lowerSluice.z);
  scene.add(lowerLight);
  state.lights.push(lowerLight);
  state.sluice = { group, runnels, highLight, midLight, lowerLight, sprayKick: 0 };
}

// THE HUNG BELL, in one place, because the collider and the swing have to
// agree with each other and with the one condition Alex put on this round:
// "make sure that's not what is causing the sound bug where that areas sound
// can completely go bad". BELL_HALF answers BELL_MAX -- at 0.055 rad about the
// chain's apex the widest iron any reachable head window can hold reaches
// 0.608 m from the axis, 0.014 m inside the 0.62 box -- and BELL_VERB and
// BELL_TOLL_GAP together hold this object below the reverb drive of the build
// he has already played.
const BELL_HALF = 0.62;      // collider half-extent (round thirteen shipped 0.75)
const BELL_MAX = 0.055;      // rad, hard cap on swing amplitude
const BELL_W2 = 3.4045;      // g / L, L = 2.882 m from the apex to the shell's centroid
const BELL_W = Math.sqrt(BELL_W2);
const BELL_DAMP = 0.14;      // 14.4 s e-fold: it is never quite still
const BELL_GUST = 0.054;     // rad/s the district's draught adds per cadence step
const BELL_PUSH = 0.024;     // rad/s per m/s of shove per second of contact
const BELL_CONTACT = BELL_HALF + 0.34 + 0.30;   // face stop 0.96, corner stop 1.217
const BELL_TOLL = 0.028;     // rad of amplitude before the loose clapper reaches iron
const BELL_TOLL_GAP = 7.3;   // s FLOOR between tolls -- round thirteen's shortest cadence
const BELL_VERB = 0.34;      // reverb send, down from round thirteen's 0.96

function buildBellCistern(game, layout, state) {
  const { scene, world, mats: M } = game;
  const C = layout.bellCistern;
  const group = new THREE.Group();
  group.name = 'optional bell cistern shortcut';
  markUnderfalls(group);
  scene.add(group);
  const iron = M.metal.clone();
  iron.color.setHex(0x3d3c37);
  if ('roughness' in iron) iron.roughness = 0.5;
  if ('emissive' in iron) {
    iron.emissive.setHex(0x120b05);
    iron.emissiveIntensity = 0.28;
  }
  const pale = M.bone.clone();
  if (pale.color) pale.color.multiplyScalar(0.7);

  // The bell is upside down and full of perfectly dry lost objects while the
  // whole district drips. There is no pickup and no key: noticing is the reward.
  // A lathed open bell reads as a bell from below. The previous clipped sphere
  // became an enormous black egg at first-person distance and hid the dry
  // keepsake shelf—the actual secret. Here the mouth faces upward, wrong-way,
  // and a pale rim makes that inversion readable by value and silhouette.
  const bellProfile = [
    [0.18, 0.00], [0.24, 0.16], [0.38, 0.52], [0.53, 0.91],
    [0.76, 1.22], [0.98, 1.38], [1.03, 1.44],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // IT HANGS, THE WAY IT WAS AUTHORED. ROUND TWELVE'S REASON FOR TAKING IT
  // DOWN WAS NOT TRUE, AND THE FALSE SENTENCE STOOD IN THIS COMMENT UNTIL NOW.
  //
  // What it said: that the bottom-origin lathe had inherited a +1.18 offset
  // from the centre-origin sphere it replaced, that only the rim was ever
  // re-based, and that a two-metre iron bell was therefore floating unattached.
  // Four parts disagree. Base C.y+1.18. Rim C.y+2.62, which is that base plus
  // the profile's own 1.44 top. Clapper C.y+1.46, sitting in the crown of a
  // bell whose crown is at 1.18. And a chain whose free end sat 0.086 m from
  // the rim ring's centre-line -- 0.011 m off its iron, i.e. hung ON it. An
  // inherited offset moves ONE part. All four were placed for a bell hanging
  // off that chain, and the chain was placed to meet it.
  //
  // The defect was never height. It was Alex, on the live build: "what is this,
  // it doesn't move or do anything" -- a complaint about PURPOSE. Round twelve
  // answered it by changing height; round thirteen answered it properly, with a
  // voice and a rock and a collider. This round puts the height back and keeps
  // the voice. His words for this round: "if you can make it swing and stuff
  // sure, let it swing or whatever if it's interactable by hitting it with the
  // skull."
  //
  // ...AND IT STAYS OFF THE LANE, SO IT CAN BE SOLID.
  //
  // Round thirteen's offset, kept and re-derived: the bisector of
  // (22,59)->(27,68)->(37,75) is (0.743,-0.670), x 1.95 gives (+1.45,-1.31),
  // and the axis lands 1.904 m off the leg in and 1.905 m off the leg out.
  // Hanging it does NOT make the node safe -- the crown still bottoms out
  // 0.685 m inside the head window of the nearest stand (see the collider
  // below, where that is measured against the real floor) -- and the culvert
  // is the STRAIGHT-AHEAD read at the fork, leaving the pump approach 15.3 deg
  // off your heading where the main route turns 48.9 deg away. A two-metre iron
  // object over that centreline is the last thing this district needs.
  const bx = C.x + 1.45, bz = C.z - 1.31;
  // The chamber vault (atmosphere.js: a 0.34-tall cap centred at chamber.y +
  // 5.18, radius r * 0.96) has its underside at C.y + 5.01 and a 12-gon
  // apothem of 3.199 m, so it stands over a bell 1.954 m off the node. That
  // underside is where the chain starts and where the pendulum pivots, so
  // nothing in this object ends in mid-air any more.
  const APEX = 5.01;
  const CROWN = 1.18;                 // authored: the lathe's base
  const RIM = CROWN + 1.44;           // authored: C.y + 2.62, the profile's top
  const RING_R = 1.03;                // authored: the pale rim's centre-line
  //
  // Bell, rim, clapper AND chain hang off ONE pivot at the top of the chain, so
  // the tick in installBeats swings the whole assembly as a pendulum instead of
  // rocking it about its own foot. A Group is free: no draw call, no renderRoot.
  const bellPivot = new THREE.Group();
  bellPivot.position.set(bx, C.y + APEX, bz);
  group.add(bellPivot);
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), iron);
  bell.position.y = CROWN - APEX;
  bell.castShadow = true;
  bellPivot.add(bell);
  const bellRim = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.075, 7, 24), pale);
  bellRim.position.y = RIM - APEX;
  bellRim.rotation.x = Math.PI / 2;
  bellPivot.add(bellRim);
  // The clapper is LOOSE, resting in the crown of an upturned bell, and that is
  // the whole striking mechanism: swing the bell, the clapper slides to the low
  // side, and at the bottom of the swing it meets the wall. Authored height.
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), iron);
  clapper.position.set(0, 1.46 - APEX, 0);
  bellPivot.add(clapper);
  //
  // THE CHAIN HOLDS THE BELL AGAIN, and it is a two-legged sling: the authored
  // chain was one leg of it and its partner was never drawn. One grip point on
  // a rim cannot hold an inverted bell level -- the shell's centroid is on the
  // axis, so a lip-hung bell settles at 64.5 deg and every dry keepsake in it
  // slides out. Two legs to opposite sides of the same ring hold it flat, and
  // that is the only reading in which the dry things stay dry things.
  //
  // Both feet land exactly ON the rim ring's centre-line by construction
  // (RING_R out, APEX - RIM down: length 2.6025, 23.31 deg from vertical) and
  // both tops meet at the vault. Round thirteen left the old chain where it
  // broke, 1.217 m from the bell it no longer held; nothing measured that, and
  // nothing measured the 1.18 either, which is how this object drifted twice.
  // tests/underfalls-expansion.mjs now reads these instance matrices back and
  // measures them against the drawn rim.
  //
  // Splayed across the bend's bisector (perpendicular to (0.743,-0.670)) so the
  // sling reads as a V from the approach instead of one leg hiding the other.
  // One InstancedMesh: two legs, one draw call -- what the single chain cost.
  const SLING_N = Math.hypot(0.670, 0.743);            // unit, so the feet land ON the ring
  const SLING_UX = 0.670 / SLING_N, SLING_UZ = 0.743 / SLING_N;
  const slingLen = Math.hypot(RING_R, APEX - RIM);
  const slingUp = new THREE.Vector3(0, 1, 0);
  const sling = addInstances(
    bellPivot, new THREE.CylinderGeometry(0.035, 0.05, slingLen, 5), iron,
    [1, -1].map((side) => {
      const foot = new THREE.Vector3(
        RING_R * SLING_UX * side, RIM - APEX, RING_R * SLING_UZ * side,
      );
      return new THREE.Matrix4().compose(
        foot.clone().multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(slingUp, foot.clone().negate().normalize()),
        new THREE.Vector3(1, 1, 1),
      );
    }),
    { name: 'bell sling' },
  );
  //
  // THE COLLIDER IS SIZED FOR THE SWEPT BELL, NOT FOR THE BELL AT REST.
  //
  // A hung bell still needs one, and this is the arithmetic rather than a
  // guess: the crown bottoms out at C.y + 1.18 while the player capsule tops
  // out at feet + 1.75 (player.js HEAD). _moveAxis only ignores a box whose
  // min.y is above that line, which would take the crown at C.y + 1.75 -- and
  // a bell you cannot reach is a bell you cannot ring.
  //
  // AND THE HEAD WINDOW IS NOT MEASURED FROM THE NODE. This paragraph used to
  // say 0.57 m of iron stands in it, which is the answer for a player standing
  // at C.y, and nobody in this room does: the chamber floor runs C.y - 0.405 to
  // C.y + 0.315 across the three metres around this object. At the nearest
  // stand the box allows -- 0.960 m out on a face -- the ground is C.y + 0.115
  // and the window reaches C.y + 1.865, so 0.685 m of iron is in it, not 0.57.
  //
  // BELL_HALF is 0.62, not the mouth's 1.105. The mouth is over a metre above
  // the top of the capsule and can never be touched, so an AABB drawn to it
  // would be a metre of invisible wall around a thin iron cone -- this
  // district's own old mistake. 0.62 answers the SWING: at BELL_MAX the widest
  // iron any reachable window can hold reaches 0.6075 m from the axis (C.y +
  // 1.869, in the window of a stand 0.961 m out on ground C.y + 0.120), so the
  // swept bell stops 0.0136 m short of that capsule at every height and every
  // phase and the box never has to move.
  // That is 0.014 and not the 0.042 this comment claimed before the floor was
  // measured; the box still holds, with a third of the air it was credited
  // with. You are held at 0.96 m on a face and 1.217 m on a corner, inside the
  // dry ring and under the mouth's overhang. It is also SMALLER than round
  // thirteen's 0.75, so the Choir loses nothing it had not already lost (one
  // chord, pump undercroft -> service climb, costing 0.57 m of detour), and the
  // nearest route sample sits 0.83 m outside it against a 0.32 m threshold.
  addColliderCylinder(world, bx, bz, BELL_HALF, C.y + CROWN, C.y + RIM, 'hung bell');
  //
  // AND ON THE LEDGER AS THE CONE IT IS, NOT AS ONE BOX.
  //
  // tests/underfalls-expansion.mjs walks every drawn silhouette this district
  // publishes against every pose the clamp and the colliders both allow, and
  // it asks each entry two questions: the flat gap, while that entry crosses
  // the pose's own head window (feet + STEP_UP .. feet + HEAD), and the 3D
  // distance from the eye, always. Round fourteen's walkthrough branch wrote
  // this entry for a bell LYING ON THE FLOOR -- one disc at the 1.03 lip for
  // the whole object, which is right for a fallen bell because a fallen bell
  // presents its mouth at body height. A hung one does not. Publishing that
  // disc next to this bell would have claimed a metre of iron in your head
  // window that is not there: the gate would be measuring an object that does
  // not exist, which is the exact failure the ledger was widened to end.
  //
  // A HUNG BELL IS A CONE, SO IT GOES ON AS A STACK. What is in the head
  // window is the narrow shoulder; the mouth is a metre over it. One prism
  // reports one radius for its whole height, so the rungs go where the answer
  // changes -- and all three are the top of somebody's head window, not round
  // numbers off the profile. The chamber floor is NOT flat: across the 2.9 m
  // the gate's own search box can reach around this object it runs C.y - 0.405
  // to C.y + 0.315, so how much of this cone can be in your window depends on
  // where you stand -- and the two move together, because ground high enough
  // to raise your window is ground you can only reach from further out.
  //
  //   C.y + 1.87  the window top of the pose that holds the LEAST air: 0.961 m
  //               out, ground C.y + 0.120, window top C.y + 1.870. No pose
  //               nearer than that reaches higher.
  //   C.y + 1.90  by here the frontier has bought room -- the nearest stand
  //               whose window passes 1.87 is 0.969 m out, and one whose
  //               window passes 1.90 is 1.182 m out.
  //   C.y + 2.10  over the top of every window there is: the highest ground
  //               the gate can reach here is C.y + 0.315, topping out at
  //               C.y + 2.065. Nothing above this rung can be a wall you walk
  //               through; the mouth and the pale rim are a near-plane
  //               question and nothing else.
  //
  // What the gate then measures of this stack: body 0.327 against the 0.32 a
  // collider-guarded face owes, camera 0.308 against the 0.24 the near plane
  // eats at. That 0.007 of headroom is not the ladder being coarse -- the true
  // triangle-level answer is 0.335, and the object itself only has 0.0136 m of
  // air (see the collider above). The one-disc-at-the-lip entry the walkthrough
  // branch wrote would have claimed 1.235 m of iron over the whole height and
  // scored 0.000. tools/probe-bell-cistern.mjs replays all of it out of band.
  //
  // THE RADII ARE READ OFF THE DRAWN GEOMETRY, NEVER TYPED, so editing
  // bellProfile, the rim or the swing cap re-derives the ledger instead of
  // leaving it describing a bell that has moved. And they are SAMPLED rather
  // than bounded, because the obvious bound is wrong about HEIGHT: under a
  // lean the point of a ring that drops furthest is the one on the far side,
  // and that point moves INWARD, not outward. So walk every drawn circle at
  // the cap lean, take where each point of it actually goes, and bin it by the
  // height it actually reaches.
  const LEAN_C = Math.cos(BELL_MAX), LEAN_S = Math.sin(BELL_MAX);
  const swungRing = (into, rho, restY) => {
    const drop = APEX - restY;
    for (let k = 0; k <= 24; k++) {
      const u = k / 12 - 1;              // cos of the way round the ring
      into.push([
        C.y + APEX - drop * LEAN_C + rho * u * LEAN_S,
        Math.hypot(rho * u * LEAN_C + drop * LEAN_S,
          rho * Math.sqrt(Math.max(0, 1 - u * u))),
      ]);
    }
  };
  const bellSwung = [], slingSwung = [];
  for (let i = 1; i < bellProfile.length; i++) {   // the lathe, at 10 mm of profile
    const a = bellProfile[i - 1], b = bellProfile[i];
    const steps = Math.ceil((b.y - a.y) / 0.01);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      swungRing(bellSwung, a.x + (b.x - a.x) * t, CROWN + a.y + (b.y - a.y) * t);
    }
  }
  for (let k = 0; k < 24; k++) {                   // the pale rim's tube: the widest iron drawn
    const a = (k / 24) * Math.PI * 2;
    swungRing(bellSwung, RING_R + Math.cos(a) * 0.075, RIM + Math.sin(a) * 0.075);
  }
  for (let k = 0; k <= 16; k++) {                  // the clapper, at the 0.045 it slides
    const a = (k / 16) * Math.PI;
    swungRing(bellSwung, Math.sin(a) * 0.24 + 0.045, 1.46 - Math.cos(a) * 0.24);
  }
  for (let k = 0; k <= 16; k++) {                  // and the two legs of the sling
    const t = k / 16;
    swungRing(slingSwung, RING_R * (1 - t) + 0.05, RIM + (APEX - RIM) * t);
  }
  const swungSpan = (points) => {
    let lo = Infinity, hi = -Infinity, widest = 0;
    for (const [y, r] of points) {
      if (y < lo) lo = y;
      if (y > hi) hi = y;
      if (r > widest) widest = r;
    }
    return { lo, hi, widest };
  };
  const bandRadius = (points, y0, y1) => {
    let r = 0;
    for (const [y, h] of points) if (y >= y0 && y <= y1 && h > r) r = h;
    return r;
  };
  const bellSpan = swungSpan(bellSwung);
  const rungs = [bellSpan.lo, C.y + 1.87, C.y + 1.90, C.y + 2.10, bellSpan.hi];
  for (let i = 0; i < rungs.length - 1; i++) {
    publishSolid(layout, {
      name: 'hung bell', guard: 'hung bell',
      y0: rungs[i], y1: rungs[i + 1],
      x: bx, z: bz, r: bandRadius(bellSwung, rungs[i], rungs[i + 1]),
    });
  }
  // The sling is its own fixture and gets its own entry: the box above ends at
  // the rim, so nothing holds you off these two legs but the district clamp --
  // the stricter of the two numbers, and never actually asked for, because
  // their lowest iron sits at C.y + 2.564 and the highest head window in this
  // room tops out at C.y + 2.065. What the ledger does ask them is the near
  // plane, which does not care which way is up: 0.784 m from the nearest eye.
  const slingSpan = swungSpan(slingSwung);
  publishSolid(layout, {
    name: 'bell sling', guard: 'clamp',
    y0: slingSpan.lo, y1: slingSpan.hi, x: bx, z: bz, r: slingSpan.widest,
  });

  // THE KEEPSAKE SHELF -- "the actual secret", two paragraphs up -- WAS A
  // PLANK YOU WALKED THROUGH, AND ITS WEST THIRD WAS OVER NOTHING.
  //
  // It was a 3.8 x 0.75 plank yawed 0.28 at (C.x-1.8, C.z+2.0), which is
  // 2.69 m out from the cistern node on a chamber of radius 3.45: union
  // clearance -0.759, and the nearest pose the clamp will hold was 0.000 m
  // from the drawn wood. You stand in it. Its top is 0.81 m over the floor
  // and STEP_UP is 0.50, so the engine calls that a wall, not a step -- and
  // buildBellCistern authored exactly one collider, the bell.
  //
  // AND THE YAW WAS NOT A SEAT. At 0.28 the plank crosses the corner rather
  // than following it: its west corner landed 4.55 m from the chamber centre
  // while the drawn sixteen-gon floor ends at 3.45, so 1.1 m of shelf, and
  // the three westmost keepsakes with it, hung over the 0x03050c background.
  // That is the same defect the dry ring below already has a paragraph about,
  // one object away.
  //
  // Seated properly now, in the frame the chamber actually has: OUT is the
  // bearing the shelf already had from the node (the outside of the bend,
  // which the bell's own comment reserves for it) and the plank runs
  // TANGENTIAL to the chamber at 2.62 m, which puts its far corners at
  // 3.35 m -- inside the floor with 0.10 m to spare -- and its whole face
  // parallel to the wall it leans on. 3.0 m long rather than 3.8, because
  // 3.8 tangential cannot fit inside this room at any radius that keeps its
  // corners on the floor.
  //
  // Then the collider a 3 m plank at waist height has to have. Eight boxes,
  // not one: this thing is yawed 42 degrees and its single AABB would be
  // 2.73 x 2.56 -- most of the room, invisible. Sliced along its own length
  // the AABBs hug it to within 0.15 m. Their half-depth is the keepsakes'
  // own reach plus (UNDERFALLS_SOLID_PAD - RADIUS), so the camera stops at
  // THE ONE PAD from drawn wood rather than merely at the player's radius:
  // a collider has no dead band the way the clamp does, so the 0.08 has to
  // be built into the box.
  const SHELF_RADIUS = 2.62;       // centre, out from the cistern node
  const SHELF_LEN = 3.0;
  const SHELF_DEPTH = 0.75;
  const SHELF_THICK = 0.18;
  const KEEP_SPAN = 1.15;          // half the keepsake row, along the plank
  const KEEP_ACROSS = 0.08;        // and its wander across it
  // half the longest rod (0.66): the most any one keepsake can reach outside
  // its own centre, whatever euler the seeded pattern hands it.
  const KEEP_REACH = 0.33;
  const out = new THREE.Vector2(-1.8, 2.0).normalize();
  const alongX = out.y, alongZ = -out.x;
  const shelfX = C.x + out.x * SHELF_RADIUS;
  const shelfZ = C.z + out.y * SHELF_RADIUS;
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(SHELF_LEN, SHELF_THICK, SHELF_DEPTH), M.woodDark);
  shelf.position.set(shelfX, C.y + 0.72, shelfZ);
  // rotation.y maps local +X to (cos, -sin) and local +Z to (sin, cos), so
  // this puts the plank's length on ALONG and its depth face on OUT.
  shelf.rotation.y = Math.atan2(-alongZ, alongX);
  group.add(shelf);
  const SHELF_GUARD_DEPTH = KEEP_ACROSS + KEEP_REACH + (UNDERFALLS_SOLID_PAD - 0.34);
  const SHELF_GUARD_LEN = KEEP_SPAN + KEEP_REACH + (UNDERFALLS_SOLID_PAD - 0.34);
  const SHELF_GUARD_PIECES = 8;
  for (let k = 0; k < SHELF_GUARD_PIECES; k++) {
    const halfAlong = SHELF_GUARD_LEN / SHELF_GUARD_PIECES;
    const t = SHELF_GUARD_LEN * (2 * (k + 0.5) / SHELF_GUARD_PIECES - 1);
    const px = shelfX + alongX * t, pz = shelfZ + alongZ * t;
    const halfX = Math.abs(alongX) * halfAlong + Math.abs(out.x) * SHELF_GUARD_DEPTH;
    const halfZ = Math.abs(alongZ) * halfAlong + Math.abs(out.y) * SHELF_GUARD_DEPTH;
    // Tall enough to cover the tallest keepsake standing on end (C.y + 1.15)
    // and far too tall to be a step; it starts below the floor so no pose can
    // ever be above it.
    world.addCollider(px - halfX, C.y - 0.4, pz - halfZ, px + halfX, C.y + 1.3, pz + halfZ,
      { underfalls: true, role: 'keepsake shelf' });
  }
  publishSolid(layout, {
    name: 'keepsake shelf plank', guard: 'keepsake shelf',
    y0: C.y + 0.72 - SHELF_THICK / 2, y1: C.y + 0.72 + SHELF_THICK / 2,
    x: shelfX, z: shelfZ,
    nx: out.x, nz: out.y, tx: alongX, tz: alongZ,
    halfN: SHELF_DEPTH / 2, halfT: SHELF_LEN / 2,
  });
  // The keepsakes go on the ledger as ONE band rather than thirteen entries:
  // the row plus a rod's reach in every direction. That is deliberately
  // stricter than the objects themselves -- it claims a rectangle where there
  // are thirteen small things -- and being over-strict is the safe direction
  // for a pin. tools/probe-cistern-shelf.mjs measures the real triangles.
  publishSolid(layout, {
    name: 'dry keepsakes', guard: 'keepsake shelf',
    y0: C.y + 0.88 - KEEP_REACH, y1: C.y + 0.915 + KEEP_REACH,
    x: shelfX, z: shelfZ,
    nx: out.x, nz: out.y, tx: alongX, tz: alongZ,
    halfN: KEEP_ACROSS + KEEP_REACH, halfT: KEEP_SPAN + KEEP_REACH,
  });
  const lost = { ringPale: [], ringIron: [], rodPale: [], rodIron: [] };
  for (let i = 0; i < 13; i++) {
    const ring = i % 3 === 0;
    const paleObject = i % 4 === 0;
    const scale = ring ? (0.11 + (i % 2) * 0.035) / 0.11 : 1;
    const height = ring ? scale : 0.42 + (i % 4) * 0.08;
    // ON the plank now, in the plank's own frame. They used to be laid out
    // in world x and z with no reference to the shelf at all, so the row ran
    // 16 degrees across it: the first one sat 0.13 m past the plank's edge
    // in mid-air, and the three at that end were over the void with it.
    const along = -KEEP_SPAN + i * (KEEP_SPAN * 2 / 12);
    const across = Math.sin(i * 2.3) * KEEP_ACROSS;
    const matrix = transformMatrix(
      shelfX + alongX * along + out.x * across,
      C.y + 0.88 + (i % 2) * 0.035,
      shelfZ + alongZ * along + out.y * across,
      i * 0.4, i * 1.7, Math.PI / 2 + Math.sin(i) * 0.4,
      scale, height, scale,
    );
    lost[`${ring ? 'ring' : 'rod'}${paleObject ? 'Pale' : 'Iron'}`].push(matrix);
  }
  const ringGeo = new THREE.TorusGeometry(0.11, 0.018, 5, 10);
  const rodGeo = new THREE.CylinderGeometry(0.035, 0.055, 1, 5);
  addInstances(group, ringGeo, pale, lost.ringPale, { name: 'dry pale keepsake rings' });
  addInstances(group, ringGeo, iron, lost.ringIron, { name: 'dry iron keepsake rings' });
  addInstances(group, rodGeo, pale, lost.rodPale, { name: 'dry pale keepsake rods' });
  addInstances(group, rodGeo, iron, lost.rodIron, { name: 'dry iron keepsake rods' });
  // The dry ring is the bell's rain shadow, so it goes where the bell goes:
  // left on the node it would be a marked circle with nothing standing in it,
  // which is the same unexplained-object defect one level down. It also has to
  // shrink to travel. At its old 2.28 outer radius, moved 1.95 m off centre,
  // its far edge would reach 4.23 m while the chamber's visible floor is a
  // sixteen-gon whose real edge on this bearing is 3.49 m — a metre of pale
  // annulus hanging over black nothing. At 1.40 the far edge is 3.35 m, inside
  // the floor, and the near edge stays 0.50 m clear of the walking line.
  // Hanging it back up is also what gives this ring anything to mean: a dry
  // annulus under an object resting ON the stone is just occluded floor.
  const dryRing = new THREE.Mesh(new THREE.RingGeometry(1.22, 1.40, 28),
    new THREE.MeshBasicMaterial({ color: 0xa6b0ad, transparent: true, opacity: 0.27, side: THREE.DoubleSide }));
  dryRing.rotation.x = -Math.PI / 2;
  dryRing.position.set(bx, C.y + 0.025, bz);
  group.add(dryRing);
  // The shelf's own pooled candle is written in the plank's frame so it
  // cannot drift off it again: 0.60 m along the row and 0.62 m out into the
  // room, which is 0.13 m past the collider's face, so it lights the
  // keepsakes from where the player stands rather than from behind them. It
  // used to be a world-space pair of numbers that happened to land 0.29 m
  // BEHIND the old plank.
  world.candles.push({
    x: shelfX + alongX * -0.60 + out.x * -0.62,
    y: C.y + 1.05,
    z: shelfZ + alongZ * -0.60 + out.y * -0.62,
    intensity: 1.25, r: 4.5,
  });
  const bellLight = new THREE.PointLight(0xd7a468, 13.5, 12, 1.15);
  markUnderfalls(bellLight);
  // The district's one cistern light follows the bell, and re-hanging the bell
  // 1.44 m moved it again. Left where round thirteen put it, the source would
  // have ended 0.389 m from the raised rim's centre-line -- a lantern at arm's
  // length, clipping the one pale thing in this room to white. So it was solved
  // for instead of nudged: this is the position that keeps the nearest PALE RIM
  // IRON at the distance it already has on the live build (0.935 m against
  // 0.937 m, irradiance x1.003 under three.js's 1/d^1.15 windowed falloff)
  // while moving 0.57 m CLOSER to the keepsake shelf, which the comment above
  // calls the actual secret.
  //
  // THOSE SHELF NUMBERS ARE RE-MEASURED, because the shelf did not stay where
  // this paragraph first found it: the same round reseated the plank tangential
  // to the chamber and shortened it to 3.0 m. Against the plank as it is drawn
  // now, round thirteen's lamp position stands 3.591 m from its nearest wood and
  // this one stands 3.017 m -- irradiance x1.222, not the x1.251 measured
  // against the plank that has been replaced.
  //
  // It clears the player rather than clearing EYE, which is not the same claim
  // on a floor that runs C.y - 0.455 to C.y + 0.350: the highest eye anything
  // can raise within 1.2 m of this lamp is 2.977 and the lamp is at 3.250, so
  // it stands 0.273 m over it, and the nearest legal eye in space is 0.390 m
  // away -- past the near plane. The shelf's own pooled candle travelled with
  // the plank and now sits 0.963 m off its wood, and the tick below still lifts
  // this light to 24 on a strike. Do NOT add a second PointLight: the census is
  // pinned at boot and a new one recompiles every lit material in the game.
  bellLight.position.set(bx - 1.42, C.y + 2.0, bz + 1.15);
  scene.add(bellLight);
  state.lights.push(bellLight);
  // `position` stays the CHAMBER NODE, not the bell: it is the discovery radius
  // and the route point the gate walks to. `strikePos` is where the loose
  // clapper meets the wall, which is where the sound has to come from -- round
  // thirteen put it at C.y + 1.15, the mid-body of a bell lying on the floor.
  state.secret = {
    group, bell, rim: bellRim, clapper, sling, pivot: bellPivot, light: bellLight,
    position: new THREE.Vector3(C.x, C.y, C.z),
    strikePos: new THREE.Vector3(bx, C.y + 1.46, bz),
    // the drawn constants, published so the gate can measure the OBJECT instead
    // of trusting a comment about it
    axis: new THREE.Vector3(bx, C.y, bz),
    apexY: C.y + APEX, crownY: C.y + CROWN, rimY: C.y + RIM, ringR: RING_R,
    maxSwing: BELL_MAX, half: BELL_HALF, tollGap: BELL_TOLL_GAP, verb: BELL_VERB,
    discovered: false,
    // the pendulum: two small-angle components about the apex. ax is the angle
    // whose crown displacement is +x, az the one whose displacement is +z.
    ax: 0.008, az: 0, avx: 0, avz: 0.004,
    glow: 0, gustT: 3.4, gustIndex: 0, tollCd: 0, prevLean2: 0, towardCentre: false,
  };
}

function buildSprayDisplacement(game, layout, state) {
  const { scene } = game;
  const mat = new THREE.MeshBasicMaterial({
    color: 0x010406, transparent: true, opacity: 0, depthWrite: false,
  });
  const root = new THREE.Group();
  root.name = 'spray displacement (not an enemy)';
  markUnderfalls(root);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.55, 4, 7), mat);
  torso.scale.set(0.7, 1.18, 0.42);
  torso.position.y = 1.5;
  root.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat);
  head.scale.set(0.72, 1.3, 0.55);
  head.position.y = 2.85;
  root.add(head);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.7, 3, 5), mat);
  arm.position.set(-0.38, 1.45, 0);
  arm.rotation.z = -0.16;
  root.add(arm);
  const arm2 = arm.clone();
  arm2.position.x = 0.38;
  arm2.rotation.z = 0.16;
  root.add(arm2);
  const p = layout.chapel;
  root.position.set(p.x + 5.8, 0.05, p.z - 2.0);
  root.visible = false;
  scene.add(root);
  state.displacement = {
    root, mat, armed: false, heard: false, revealed: false, t: 0,
    positions: [
      new THREE.Vector3(p.x + 5.8, 0.05, p.z - 2.0),
      new THREE.Vector3(p.x - 4.8, 0.05, p.z + 5.0),
      new THREE.Vector3(layout.sluiceRise.x + 3.6, layout.sluiceRise.y, layout.sluiceRise.z - 2.4),
    ],
    index: 0,
  };
}

// --------------------------------------------------------------- water, seen
//
// His notes: steam in the air, water on the camera when you get splashed,
// drips off the ceiling, a wet rock path, "a bit of steam towards the sides of
// the area but not on the path", and the Drowned Choir standing in it. Three
// of those four live here. The fourth is a branch in the grain quad main.js
// already draws on top of every frame (main.js splashLens/uWet), fed from the
// two places in this file where the player is physically in water.
//
// ALL THREE ARE GPU-PHASE SYSTEMS, NOT PARTICLE POOLS. Every position is
// authored once at build time into a static buffer, and every motion is a
// function of ONE uniform clock evaluated in the vertex shader. Tickers run
// inside step() at the FIXED 1/120 timestep, so a per-particle CPU loop here
// would be paid twice per displayed frame at 60 Hz and up to ten times after a
// hitch. Between them these three cost six uniform writes and 29 Math.floor
// calls per step, and allocate nothing after boot.
//
// FOG IS MANUAL IN ALL THREE. A ShaderMaterial gets none of three's fog
// chunks, so without an explicit exp(-(density*d)^2) term these would be the
// only things in a FogExp2 district that never fade, and a corridor forty
// metres off would read as a lit tunnel. The density is read live off
// scene.fog every step, because the act change eases it over about a second.
//
// NOTHING HERE ADDS A LIGHT OR A CANDLE DESCRIPTOR. The shader light census is
// pinned (World.pinLightCensus) and the candle pool is eight slots the cave
// already half-spends on its curtains; either would relink the whole game.

// The shared clock is wrapped at t % 600 the way atmosphere.js wraps its own,
// so fract() cannot lose precision in a long session. Every phase rate below
// is therefore an exact multiple of TAU/600 (for a sin) or 1/600 (for a
// fract), because a rate that is not lands the wrap mid-cycle and the whole
// district pops once every ten minutes.
const WATER_WRAP = 600;
const SWAY_A = 11 * TAU / WATER_WRAP;    // 0.115192 rad/s
const SWAY_B = 7 * TAU / WATER_WRAP;     // 0.073304 rad/s
// Real gravity. The CPU tick that voices a landing re-derives the same fall
// time from the same constant; if one moves the other moves in the same edit
// or the drip sound walks off its own splash.
const DRIP_G = 9.81;
// The route roof is one slab per leg centred at avgY + 4.86, 0.46 thick, so
// its underside is avgY + 4.63 (addFloorAndShell, above). The decorative
// chamber vault is a 0.34-tall cylinder centred at chamber.y + 5.18, or 5.72
// at the chapel (atmosphere.js).
const ROUTE_ROOF_UNDER = 4.63;
const CHAMBER_VAULT_UNDER = 5.18 - 0.17;
const CHAPEL_VAULT_UNDER = 5.72 - 0.17;
// Clear air over the drawn path, and never a puff over an unfloored void.
const STEAM_RIBBON_GAP = 0.20;
const STEAM_FLOOR_GAP = 0.15;

// The wet ribbon's own half-width, from addFloorAndShell. COUPLED: if the
// walkway's paving ever changes that expression, change it here too, or the
// steam creeps onto the path and the drips stop landing on lit stone.
function ribbonHalfWidth(w) {
  return clamp(w * 0.46, 0.94, 1.72);
}

// -------------------------------------------------------------- the wet path
//
// AND IT HAS TO READ WET, WHICH A LAMBERT RIBBON CANNOT.
//
// Wetness is a specular phenomenon, and MeshLambertMaterial in this three
// build has no specular term at all: RE_Direct_Lambert is irradiance *
// BRDF_Lambert and nothing else. The ribbon's material is a clone of
// M.headstone, which is lam(), so it can only ever have been a PALE line --
// which is what Alex photographed. (The wetStone.roughness assignment up in
// addFloorAndShell is dead code guarded into silence: Lambert has no such
// property, so nobody has ever been looking at a roughness-0.16 surface.)
//
// This sheet supplies the missing term with no light, no lantern and no render
// target: a grazing-angle band computed from cameraPosition, broken by two
// slow crossing rivulets. It is brightest looking DOWN the corridor and is
// held at zero under your own feet -- exactly how a wet floor behaves, and it
// keeps the additive term out of the near field where a pale albedo would
// clip. It therefore ADDS to the ribbon-against-shoulder contrast that carries
// the district's wayfinding, instead of washing it out.
//
// One InstancedMesh, one draw call, 145 unit quads, 290 triangles, no collider
// (underfallsGroundAt is analytic and never reads this).
//
// DIALS, in order: uGain, then the Fresnel exponent -- raising it toward 5.0
// narrows the band toward the horizon, which is the fix if it reads as a
// glowing runway rather than as gloss.
const SHEEN_LIFT = 0.075;   // 33 mm over the ribbon's top face at y + 0.042

function buildPathSheen(game, layout, state) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: 0.055 },
      uGain: { value: 0.9 },
    },
    vertexShader: `
      varying vec3 vW;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      varying vec3 vW;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uFog;
      uniform float uGain;
      void main(){
        vec3 V = cameraPosition - vW;
        float d = length(V);
        V /= max(0.001, d);
        // the sheet is flat and faces up, so N = (0,1,0) and the grazing term
        // is just 1 - |V.y|. No light is consulted; there is none down here.
        float fres = pow(clamp(1.0 - abs(V.y), 0.0, 1.0), 3.4);
        // two slow crossing rivulets, so the band is broken water and not a
        // painted strip
        float r1 = sin(vW.x * 1.7 + vW.z * 1.1 + uTime * ${SWAY_A.toFixed(6)});
        float r2 = sin(vW.z * 2.3 - vW.x * 0.9 - uTime * ${SWAY_B.toFixed(6)});
        float riv = 0.62 + 0.38 * (0.5 + 0.5 * r1 * r2);
        // Fade the tread ACROSS the corridor only, so the sheet dies inside
        // the ribbon instead of drawing its own rectangle on it. Never along
        // the tread: that would put a dim band at every joint, 0.85 m apart,
        // and down a grazing corridor 145 of those compress into a
        // shimmering ladder -- the artefact class this district has already
        // paid for. Treads butt end to end and the 17 mm gap is sub-pixel.
        float edge = smoothstep(0.0, 0.17, vUv.x) * smoothstep(0.0, 0.17, 1.0 - vUv.x);
        float fog = exp(-(uFog * d) * (uFog * d));
        // dark at your feet: a wet floor reflects the far end of the room, not
        // the stone you are standing on
        float near = smoothstep(1.1, 4.5, d);
        float a = fres * riv * edge * fog * near * uGain;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vec3(0.52, 0.62, 0.66), clamp(a, 0.0, 0.62));
      }
    `,
  });
  const matrices = [];
  for (const seg of layout.mainSegments) {
    const n = Math.max(2, Math.ceil(seg.length / 0.9));
    const yaw = Math.atan2(seg.dx, seg.dz);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const w = lerp(seg.a.w, seg.b.w, t);
      matrices.push(transformMatrix(
        lerp(seg.a.x, seg.b.x, t),
        lerp(seg.a.y, seg.b.y, t) + SHEEN_LIFT,
        lerp(seg.a.z, seg.b.z, t),
        0, yaw, 0,
        // the ribbon's own width, and a tread 2% SHORT of its pitch. The
        // ribbon underneath overlaps its neighbour by 0.08 m; an ADDITIVE
        // sheet doing the same would draw a bright seam every 0.85 m all the
        // way down the corridor.
        2 * ribbonHalfWidth(w), 1, (seg.length / n) * 0.98));
    }
  }
  const mesh = addInstances(game.scene, geometry, material, matrices, {
    name: 'underfalls wet path sheen',
  });
  if (!mesh) return;
  markUnderfalls(mesh);
  mesh.frustumCulled = false;   // unit-geometry bounds sit at the origin
  state.pathSheen = mesh;
}

// ----------------------------------------------------------------- low steam
//
// "a bit of steam towards the sides of the area but not on the path", and "the
// bottom of the level could be in [steam]" -- with the Choir standing in it.
// One Points batch, one draw call, two uniform writes a step.
//
// NOT ON THE PATH IS ENFORCED, NOT INTENDED. Corridor puffs are authored into
// the band between the wet ribbon's edge and the corridor's edge, and then
// every candidate -- corridor and chamber alike -- goes through two build-time
// tests: it must clear the MAIN route's drawn ribbon by STEAM_RIBBON_GAP, and
// it must stand at least STEAM_FLOOR_GAP inside the walkable union, so no puff
// can hang over a stretch of floor that was never drawn. (An earlier draft
// pushed the puffs to w + 0.8 and beyond, which is where the corridor's
// side-wall backing stands: a third of them would have been buried in five
// metres of solid rock and the rest suspended over nothing.)
//
// Chamber puffs ARE allowed inside the disc -- that is where the Choir stands
// and where "the bottom of the level" is -- but only in the outer annulus and
// only ankle-to-knee, so the walking line through a room stays clear air.
function buildLowSteam(game, layout, state) {
  const rng = new RNG(0x57ea3fa1);
  const pos = [], phase = [], span = [], rate = [], sway = [];
  const push = (x, y, z) => {
    pos.push(x, y, z);
    phase.push(rng.float());
    span.push(rng.range(0.55, 1.25));
    // rise cycles per second, quantised to k/600 so the t % 600 wrap is exact
    rate.push(Math.round(WATER_WRAP / rng.range(12, 26)) / WATER_WRAP);
    sway.push(rng.range(0.45, 1.0));
  };
  const clearOfPath = (x, z) => {
    const onPath = projectUnderfallsMain(layout, x, z);
    if (!onPath || onPath.d < ribbonHalfWidth(onPath.w) + STEAM_RIBBON_GAP) return false;
    const floor = projectUnderfalls(layout, x, z);
    return !!floor && floor.clearance <= -STEAM_FLOOR_GAP;
  };
  for (const seg of layout.mainSegments) {
    const stations = Math.max(2, Math.round(seg.length / 2.2));
    const spacing = seg.length / stations;
    const reach = Math.min(0.9, spacing * 0.5);   // never wander into the next station
    const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
    const nx = tz, nz = -tx;
    for (let i = 0; i < stations; i++) {
      const t = (i + 0.5) / stations;
      const cx = seg.a.x + seg.dx * t;
      const cz = seg.a.z + seg.dz * t;
      const cy = lerp(seg.a.y, seg.b.y, t);
      const w = lerp(seg.a.w, seg.b.w, t);
      const inner = ribbonHalfWidth(w) + STEAM_RIBBON_GAP;
      const outer = w - STEAM_FLOOR_GAP;
      if (outer <= inner) continue;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const off = lerp(inner, outer, (k + rng.range(0.15, 0.85)) / 3);
          const along = rng.range(-reach, reach);
          const x = cx + nx * side * off + tx * along;
          const z = cz + nz * side * off + tz * along;
          if (!clearOfPath(x, z)) continue;
          push(x, cy + rng.range(0.02, 0.30), z);
        }
      }
    }
  }
  for (const chamber of layout.chambers) {
    // density, not count: the chapel is a room and the bell cistern is a closet
    const count = Math.round(chamber.r * chamber.r * 0.553);
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, TAU);
      const rr = chamber.r * rng.range(0.63, 1.0);
      const x = chamber.x + Math.cos(a) * rr;
      const z = chamber.z + Math.sin(a) * rr;
      if (!clearOfPath(x, z)) continue;
      push(x, chamber.y + rng.range(0.02, 0.26), z);
    }
  }
  if (!pos.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geometry.setAttribute('aSpan', new THREE.Float32BufferAttribute(span, 1));
  geometry.setAttribute('aRate', new THREE.Float32BufferAttribute(rate, 1));
  geometry.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: 0.055 },
      uSize: { value: 17.0 },
      uOpacity: { value: 0.20 },
      uTint: { value: new THREE.Color(0x4d616a) },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSpan;
      attribute float aRate;
      attribute float aSway;
      varying float vAlpha;
      uniform float uTime;
      uniform float uFog;
      uniform float uSize;
      void main(){
        float u = fract(uTime * aRate + aPhase);
        vec3 p = position;
        p.y += u * aSpan;
        p.x += sin(uTime * ${SWAY_A.toFixed(6)} + aPhase * ${TAU.toFixed(6)}) * 0.22 * aSway;
        p.z += cos(uTime * ${SWAY_B.toFixed(6)} + aPhase * ${TAU.toFixed(6)}) * 0.18 * aSway;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float fog = exp(-(uFog * d) * (uFog * d));
        // in off the floor, gone before the top of its own span
        float life = smoothstep(0.0, 0.22, u) * (1.0 - smoothstep(0.52, 1.0, u));
        vAlpha = life * fog;
        gl_PointSize = clamp(uSize * (44.0 / max(1.0, d)), 1.0, 68.0);
        // LOAD-BEARING, not a nicety: a zero point size rasterizes nothing, so
        // every puff the fog has already killed costs vertex work only.
        gl_PointSize *= step(0.004, vAlpha);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      uniform vec3 uTint;
      uniform float uOpacity;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = pow(max(0.0, 1.0 - d), 2.4);
        gl_FragColor = vec4(uTint, core * uOpacity * vAlpha);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'underfalls low steam';
  points.frustumCulled = false;   // the vertex shader displaces every puff
  markUnderfalls(points);
  game.scene.add(points);
  state.steam = points;
}

// ------------------------------------------------------------- ceiling drips
//
// The drip SOUND has been playing for rounds with nothing to see: director.js
// fires audio.caveDrip on a 2.7/4.05/3.25/4.8 s cadence around route nodes and
// chamber centres, and nothing has ever fallen. These are the drops that sound
// has been waiting for. Two points per site -- the bead and its splash -- one
// draw call, all motion in the vertex shader off one clock.
//
// Every site lands ON the wet ribbon on purpose. A splash in the black gutter
// either side is a splash nobody sees; on the district's one pale surface it
// reads.
//
// HEADROOM IS CLAMPED, NOT ASSUMED. The route roof is one slab per leg placed
// at the leg's AVERAGE elevation, while a site takes the LOCAL one, so on the
// sluice rise (1.6 m of climb over 10.8 m) an unclamped 4.4 m site would start
// inside or above the rock. Each site's fall is capped 0.15 m below its own
// leg's roof underside, and below the chamber vault where one hangs lower.
function buildCeilingDrips(game, layout, state) {
  const rng = new RNG(0x0d719b3d);
  const segs = layout.mainSegments;
  const last = segs[segs.length - 1];
  const total = last.distance + last.length;
  const SITES = 29;
  const sites = [];
  const pos = [], kind = [], phase = [], period = [], fall = [];
  for (let i = 0; i < SITES; i++) {
    const s = (i + 0.5) * (total / SITES);
    let seg = last;
    for (const c of segs) { if (s <= c.distance + c.length) { seg = c; break; } }
    const t = clamp((s - seg.distance) / (seg.length || 1), 0, 1);
    const nx = seg.dz / seg.length, nz = -seg.dx / seg.length;
    const w = lerp(seg.a.w, seg.b.w, t);
    const off = rng.range(-0.72, 0.72) * ribbonHalfWidth(w);
    const x = seg.a.x + seg.dx * t + nx * off;
    const z = seg.a.z + seg.dz * t + nz * off;
    const y = lerp(seg.a.y, seg.b.y, t);
    let ceiling = (seg.a.y + seg.b.y) * 0.5 + ROUTE_ROOF_UNDER;
    for (const chamber of layout.chambers) {
      if (Math.hypot(x - chamber.x, z - chamber.z) > chamber.r * 0.96) continue;
      ceiling = Math.min(ceiling, chamber.y + (chamber.name === 'drowned pump chapel'
        ? CHAPEL_VAULT_UNDER : CHAMBER_VAULT_UNDER));
    }
    const headroom = Math.min(rng.range(3.3, 4.4), ceiling - y - 0.15);
    // quantised so the ten-minute clock wrap lands on a cycle boundary
    const per = WATER_WRAP / Math.round(WATER_WRAP / rng.range(2.6, 6.2));
    const ph = rng.float();
    if (headroom < 1.2) continue;
    sites.push({
      x, z, period: per, phase: ph, lastCycle: -1,
      fallFrac: Math.sqrt(2 * headroom / DRIP_G) / per,
      landing: new THREE.Vector3(x, y + 0.05, z),
    });
    for (const k of [0, 1]) {
      pos.push(x, y + 0.035, z);
      kind.push(k); phase.push(ph); period.push(per); fall.push(headroom);
    }
  }
  if (!sites.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geometry.setAttribute('aPeriod', new THREE.Float32BufferAttribute(period, 1));
  geometry.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: 0.055 },
      uSize: { value: 5.5 },
      uOpacity: { value: 0.62 },
    },
    vertexShader: `
      attribute float aKind;
      attribute float aPhase;
      attribute float aPeriod;
      attribute float aFall;
      varying float vAlpha;
      varying float vKind;
      uniform float uTime;
      uniform float uFog;
      uniform float uSize;
      void main(){
        float fallT = sqrt(2.0 * aFall / ${DRIP_G.toFixed(2)});
        float fallFrac = fallT / aPeriod;
        float fr = fract(uTime / aPeriod + aPhase);
        vec3 p = position;
        vKind = aKind;
        float a = 0.0;
        float grow = 1.0;
        if (aKind < 0.5) {
          float tt = fr * aPeriod;
          p.y += max(0.0, aFall - 0.5 * ${DRIP_G.toFixed(2)} * tt * tt);
          a = step(fr, fallFrac) * smoothstep(0.0, 0.07, fr / max(fallFrac, 0.0001));
          // the bead fattens as it accelerates: a crude motion smear, and the
          // only thing that makes a 9 m/s drop legible without a streak quad
          grow = 1.0 + 0.9 * clamp(fr / max(fallFrac, 0.0001), 0.0, 1.0);
        } else {
          float since = (fr - fallFrac) * aPeriod;
          a = step(0.0, since) * (1.0 - smoothstep(0.0, 0.30, since));
          grow = 2.3;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float fog = exp(-(uFog * d) * (uFog * d));
        vAlpha = a * fog;
        gl_PointSize = clamp(uSize * grow * (44.0 / max(1.0, d)), 1.0, 26.0);
        gl_PointSize *= step(0.004, vAlpha);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vKind;
      uniform float uOpacity;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        // the bead is a hard little glint; the splash is a soft opening ring
        float core = vKind < 0.5
          ? pow(max(0.0, 1.0 - d), 1.4)
          : smoothstep(0.35, 0.86, d) * (1.0 - smoothstep(0.86, 1.0, d));
        gl_FragColor = vec4(vec3(0.62, 0.72, 0.76), core * uOpacity * vAlpha);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'underfalls ceiling drips';
  points.frustumCulled = false;   // the vertex shader lifts every bead
  markUnderfalls(points);
  game.scene.add(points);
  state.drips = { points, material, sites, cooldown: 0 };
}

function buildHatchCistern(game, layout, state) {
  const { world, scene, mats: M } = game;
  const H = layout.hatch;
  const y = H.y;
  const r = 4.0;
  // 24 mm under the chamber disc and 12 under the corridor strip: this square
  // used to top out at exactly y, coplanar with both of them across the arrival
  // room. One surface per tier, no shared planes.
  world.box(M.rock, H.x, y - 0.174, H.z, r * 2, 0.3, r * 2);
  world.box(M.rock, H.x + r, y + 2.0, H.z, 0.8, 4.5, r * 2);
  // West shell is a north-only segment: the full-length slab used to cross the
  // authored entry diagonal as ghost geometry. What remains is visually AND
  // physically a wall (matching collider below); the southwest quadrant is
  // genuinely open both ways.
  world.box(M.rock, H.x - r, y + 2.0, H.z + (r - 0.6) / 2, 0.8, 4.5, r + 0.6);
  world.box(M.rock, H.x, y + 2.0, H.z + r, r * 2, 4.5, 0.8);
  world.box(M.rock, H.x, y + 4.15, H.z, r * 2 + 0.4, 0.5, r * 2 + 0.4);
  world.addCollider(H.x + r - 0.4, y - 1, H.z - r, H.x + r + 0.4, y + 4, H.z + r,
    { underfalls: true, role: 'hatch chamber wall' });
  // Southwest stays open: the descending spill arrives diagonally through that
  // corner. The west collider must not reach south of H.z-0.6 or it would
  // counterfeit a wall across that entrance (and into the choir's routing).
  world.addCollider(H.x - r - 0.4, y - 1, H.z - 0.6, H.x - r + 0.4, y + 4, H.z + r,
    { underfalls: true, role: 'hatch chamber wall' });
  world.addCollider(H.x - r, y - 1, H.z + r - 0.4, H.x + r, y + 4, H.z + r + 0.4,
    { underfalls: true, role: 'hatch chamber wall' });
  // The arrival room is the one place in the district where the collider IS
  // the drawn box, bit for bit, so the player's centre stops at exactly
  // RADIUS from the stone it can see. That is what a wall is, and it is the
  // best case the ledger has -- but it is only true while the three boxes
  // above and the three colliders beside them keep the same numbers, so all
  // three go on the ledger and the gate re-derives it every run. The floor
  // slab (y - 0.174) and the cap (y + 4.15) stay off it: one is the floor and
  // the other is 2.4 m over HEAD.
  publishSolid(layout, {
    name: 'hatch chamber wall (east)', guard: 'hatch chamber wall',
    y0: y - 0.25, y1: y + 4.25,
    x: H.x + r, z: H.z, nx: 1, nz: 0, tx: 0, tz: 1, halfN: 0.4, halfT: r,
  });
  publishSolid(layout, {
    name: 'hatch chamber wall (west)', guard: 'hatch chamber wall',
    y0: y - 0.25, y1: y + 4.25,
    x: H.x - r, z: H.z + (r - 0.6) / 2,
    nx: 1, nz: 0, tx: 0, tz: 1, halfN: 0.4, halfT: (r + 0.6) / 2,
  });
  publishSolid(layout, {
    name: 'hatch chamber wall (north)', guard: 'hatch chamber wall',
    y0: y - 0.25, y1: y + 4.25,
    x: H.x, z: H.z + r, nx: 0, nz: 1, tx: 1, tz: 0, halfN: 0.4, halfT: r,
  });

  const hatch = new THREE.Group();
  hatch.name = 'cave ceiling hatch';
  markUnderfalls(hatch);
  // The player approaches without the skull and must look almost straight up.
  // Ordinary dark wood/iron vanished against the sealed ceiling even when the
  // floor was readable. These are still physical materials, but their value and
  // restrained emissive response preserve the hatch square, frame and chains
  // between local fixtures without adding another light.
  const hatchWood = M.woodDark.clone();
  hatchWood.color.setHex(0x596365);
  if ('emissive' in hatchWood) {
    hatchWood.emissive = new THREE.Color(0x182022);
    hatchWood.emissiveIntensity = 0.58;
  }
  const hatchMetal = M.metal.clone();
  hatchMetal.color.setHex(0x8a9697);
  if ('emissive' in hatchMetal) {
    hatchMetal.emissive = new THREE.Color(0x20292b);
    hatchMetal.emissiveIntensity = 0.68;
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 1.2), hatchWood);
  door.position.y = 3.78;
  hatch.add(door);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.11, 6, 4), hatchMetal);
  frame.rotation.x = Math.PI / 2;
  frame.rotation.z = Math.PI / 4;
  frame.position.y = 3.68;
  hatch.add(frame);
  // Two short, mismatched pull chains turn the final ceiling square into an
  // authored physical destination instead of a glowing texture. They stop at
  // different heights, keeping the hatch tantalisingly reachable without
  // stealing movement or inventing a climb input.
  // AND THE LONG ONE HUNG INTO YOUR HEAD. At 0.23 m of pitch the eighth link
  // sat at 3.42 - 7 * 0.23 = 1.81, and a 0.12/0.022 torus at 0.72 scale
  // reaches 0.102, so its underside was 1.708 -- BELOW HEAD (1.75). Standing
  // where the player has to stand to look up at the hatch, the camera came
  // within 0.093 m of it: inside the 0.2 near plane, so the last link of the
  // chain was clipped away exactly when you were looking at it.
  //
  // 0.18 of pitch instead. Eight and six links still, still mismatched, and
  // links whose outer diameter is 0.204 now overlap by 0.024 -- which is what
  // chain links do. The long chain's underside lands at 2.058: 0.31 m over
  // HEAD, and 0.438 m over the camera, which is THE ONE PAD from an eye
  // standing directly beneath it.
  const CHAIN_PITCH = 0.18;
  const CHAIN_REACH = 0.102;   // (0.12 major + 0.022 tube) * 0.72 scale
  const chainMatrices = [];
  for (let side = -1; side <= 1; side += 2) {
    const links = side < 0 ? 8 : 6;
    for (let i = 0; i < links; i++) {
      chainMatrices.push(transformMatrix(side * 0.46, 3.42 - i * CHAIN_PITCH, 0.38,
        0, (i & 1) * Math.PI / 2, 0, 0.72, 0.72, 0.72));
    }
    // Overhead, but on the ledger: a thing hanging over the player is out of
    // the head window and still perfectly able to sit inside the near plane,
    // which is how this one got here. The gate measures the eye against the
    // whole prism, not just its footprint.
    publishSolid(layout, {
      name: 'hatch pull chain', guard: 'clamp',
      y0: y + 3.42 - (links - 1) * CHAIN_PITCH - CHAIN_REACH,
      y1: y + 3.42 + CHAIN_REACH,
      x: H.x + side * 0.46, z: H.z + 0.38, r: CHAIN_REACH,
    });
  }
  addInstances(hatch, new THREE.TorusGeometry(0.12, 0.022, 5, 10), hatchMetal, chainMatrices,
    { name: 'mismatched hatch pull chains' });
  // "the thing at the end should be more visible with a handle" — the same
  // handle language as every other thing you can open: a bar and brackets
  // on the door's underside, facing the upturned player.
  const hatchHandleMat = new THREE.MeshStandardMaterial({
    // pale diffuse + dark emissive, exactly the basement hatch's handle
    // language (house.js) — value contrast against the darker door, not hue
    color: 0x8f9694, roughness: 0.4, metalness: 0.7,
    emissive: 0x22282a, emissiveIntensity: 0.85,
  });
  const hatchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.56, 8), hatchHandleMat);
  hatchHandle.rotation.z = Math.PI / 2;
  hatchHandle.position.set(0, 3.56, 0);
  hatch.add(hatchHandle);
  for (const side of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), hatchHandleMat);
    bracket.position.set(side * 0.24, 3.64, 0);
    hatch.add(bracket);
  }
  hatch.position.set(H.x, y, H.z);
  scene.add(hatch);

  const post = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.95, 1.65),
    new THREE.MeshBasicMaterial({ visible: false }));
  markUnderfalls(post);
  post.position.set(H.x, y + 2.9, H.z);
  scene.add(post);
  world.registerInteract(post, 'caveHatch', () => {
    if (game.act !== 'cave' || !game.flags.has('waterfallTaken')) return;
    game.director.enterMirrorRoom();
  });
  world.candles.push({ x: H.x - 1.45, y: y + 0.55, z: H.z, intensity: 1.7, r: 5.4 });
  world.candles.push({ x: H.x + 1.45, y: y + 0.55, z: H.z, intensity: 1.7, r: 5.4 });
  game.caveEnd = new THREE.Vector3(H.x, y, H.z);
  state.hatch = { group: hatch, post, position: game.caveEnd.clone() };
}

function installClamp(game, layout, state) {
  const previous = game.world.postClamp;
  state.previousClamp = previous;
  state.clamp = (pos, dt) => {
    if (game.act !== 'cave') {
      if (previous) previous(pos, dt);
      return;
    }
    const b = layout.bounds;
    if (pos.x < b.minX - 4 || pos.x > b.maxX + 4 || pos.z < b.minZ - 4 || pos.z > b.maxZ + 4) {
      // A malformed/out-of-bounds pose still resolves to authored ground rather
      // than falling forever. Keep it deterministic for death/teleport probes.
      const p = projectUnderfalls(layout, pos.x, pos.z);
      if (!p) return;
    }
    const beforeX = pos.x, beforeZ = pos.z;
    const p = projectUnderfalls(layout, pos.x, pos.z);
    if (!p || p.clearance <= -0.04) return;
    const safeW = Math.max(0.35, p.w - 0.08);
    if (p.d < 1e-5) {
      pos.x = p.cx;
      pos.z = p.cz;
    } else {
      const k = safeW / p.d;
      pos.x = p.cx + (pos.x - p.cx) * k;
      pos.z = p.cz + (pos.z - p.cz) * k;
    }

    // Player vertical integration ran at the old XZ. At the overflow/chamber
    // joins, a five-centimetre lateral correction can cross onto a floor more
    // than a metre higher. Reconcile only the live player: generic projection
    // queries remain pure XZ clamps. Grounded feet own the new floor exactly;
    // airborne motion remains continuous unless it would penetrate that floor.
    if (pos === game.player.pos && Math.hypot(pos.x - beforeX, pos.z - beforeZ) > 1e-5) {
      const ground = underfallsGroundAt(layout, pos.x, pos.z);
      if (Number.isFinite(ground)) {
        if (game.player.grounded) {
          pos.y = ground;
          game.player.fallV = 0;
        } else if (pos.y < ground) {
          pos.y = ground;
          game.player.fallV = Math.max(0, game.player.fallV);
        }
      }
    }
  };
  game.world.postClamp = state.clamp;
}

function installCaveVisibility(game, state) {
  const saved = new Map();
  let active = false;
  let sky = null;
  const caveAtmosphereNames = new Set([
    'cave broken wall skin',
    'underfalls chamber ceiling vaults',
    'cave stalactites',
    'cave mica trail (grows toward the way out)',
    'underfalls interior cataracts',
    'underfalls displaced spray',
  ]);
  const restore = () => {
    if (!active) return;
    for (const [child, visible] of saved) child.visible = visible;
    saved.clear();
    active = false;
  };
  const keep = (child, enemyRoots) => child === game.camera
    || child === game.atmosphere?.group
    || child === game.skull?.root
    || child === game.clearingPool
    || child.userData?.underfalls
    // The pinned census rides in ONE group (World.pinLightCensus lifts every
    // boot light into world.lightRoot). `child.isLight` was written before
    // that lift and no longer matches anything at scene level — hiding the
    // group un-lights the entire district. Every seal spares lightRoot.
    || child === game.world.lightRoot
    || child.isLight
    || child === game.world.moon?.target
    || enemyRoots.has(child)
    // Underfalls floors and structural backing are compiled into the world's
    // shared rock batch at boot. Keeping that one batch costs one call; the
    // hundreds of distant house/basement prop meshes do not belong in a cave
    // render merely because the camera happens to face southwest.
    // ...and it is the SHELL that carries them, never game.mats.rock itself.
    // finishStatic merges under a clone (world.js), so this used to read
    // `child.material === game.mats.rock`, which no mesh in the scene can ever
    // satisfy — and the cave was drawn without its floor from 2026-08-14 until
    // this line was fixed. Ask the World what it cloned instead.
    || (child.isMesh && child.material && child.material === game.world.shellFor(game.mats.rock))
    // materials the district authored for itself (wet ribbon, dry lintel)
    || (child.isMesh && child.material?.userData?.underfalls);

  game.tickers.push(() => {
    const inCave = game.act === 'cave';
    if (!inCave && active) {
      restore();
      return;
    }
    if (!inCave) return;
    active = true;
    const enemyRoots = new Set((game.enemies?.list || []).map((e) => e.mesh));
    for (const child of game.scene.children) {
      if (keep(child, enemyRoots)) continue;
      if (!saved.has(child)) saved.set(child, child.visible);
      child.visible = false;
    }
    // The atmosphere root contains both cave dressing and every exterior
    // stratum. Keep its six named cave batches and hide the outdoor siblings;
    // this removes not just the moon sky subtree but distant grave/forest
    // silhouettes that could otherwise show through an oblique shell seam.
    const atmosphereRoot = game.atmosphere?.group;
    sky = sky || atmosphereRoot?.getObjectByName('moon sky') || null;
    for (const child of atmosphereRoot?.children || []) {
      if (caveAtmosphereNames.has(child.name)) continue;
      if (!saved.has(child)) saved.set(child, child.visible);
      child.visible = false;
    }
  });
  state.visibility = {
    saved,
    restore,
    get active() { return active; },
    get sky() { return sky; },
  };
}

function installBeats(game, layout, state) {
  const cameraPos = new THREE.Vector3();
  const cameraDir = new THREE.Vector3();
  const entrance = layout.entrance;
  game.tickers.push((dt, t) => {
    const inCave = game.act === 'cave';
    // DRESSED BEFORE YOU CAN SEE IN. His note: the entrance "loads 2 distinct
    // things, one before the other". It does, and the first of them is a bare
    // slab: the cave's structural rock is compiled into the world's shared
    // batch and is therefore ALWAYS drawn, while the skin that breaks it into
    // rock — and the stalactites, the mica, the cataracts — only appear when
    // the act flips. From the last stones the mouth was one flat untextured
    // face several metres wide (raycast: the shared rock batch at the mouth,
    // south-facing, nothing in front of it). Wake the district a few metres
    // early, once the bargain is struck, so the inside is already dressed the
    // first time it is visible. The act line still owns everything else.
    const nearMouth = !inCave
      && game.flags.has('waterfallTaken')
      && game.act === 'clearing'
      && Math.abs(game.player.pos.x - entrance.x) < 13
      && game.player.pos.z > entrance.z - 19
      && game.player.pos.z < entrance.z + 5;
    const dressed = inCave || nearMouth;
    if (state.renderActive !== dressed) {
      if (dressed) {
        for (const root of state.renderRoots || []) {
          root.visible = state.renderVisibility?.get(root) !== false;
        }
      } else {
        for (const root of state.renderRoots || []) {
          state.renderVisibility?.set(root, root.visible);
          root.visible = false;
        }
      }
      state.renderActive = dressed;
    }
    if (state.lightsActive !== dressed) {
      state.lightsActive = dressed;
      for (const light of state.lights) light.visible = dressed;
    }
    // Six uniform writes for three whole effects. The clock is wrapped the way
    // atmosphere.js wraps its own so a long session cannot lose float
    // precision in fract(); every rate in those shaders is quantised against
    // this same 600 s so the wrap lands on a cycle boundary, and the drip tick
    // below wraps identically so the audio never drifts off the splash. Fog is
    // read live rather than pinned, because a ShaderMaterial gets none of
    // three's fog chunks and the act change eases scene.fog.density over about
    // a second. Driven in the DRESSED branch, not after the act line, so the
    // steam is already moving during the nearMouth pre-dress -- the entrance
    // must never load in two stages again.
    const gt = t % WATER_WRAP;
    if (dressed) {
      const fogD = game.scene.fog?.density ?? 0.055;
      if (state.steam) {
        state.steam.material.uniforms.uTime.value = gt;
        state.steam.material.uniforms.uFog.value = fogD;
      }
      if (state.drips) {
        state.drips.material.uniforms.uTime.value = gt;
        state.drips.material.uniforms.uFog.value = fogD;
      }
      if (state.pathSheen) {
        state.pathSheen.material.uniforms.uTime.value = gt;
        state.pathSheen.material.uniforms.uFog.value = fogD;
      }
    }
    // Underfalls is a sealed district, not nine global point lights and a set
    // of machines animating beneath every other act. Pause all of its visual
    // work while the player is elsewhere; the cave resumes from monotonic game
    // time on entry without advancing hidden per-frame state.
    if (!inCave) return;

    if (state.pump) {
      const p = state.pump;
      p.kick = Math.max(0, p.kick - dt * 0.62);
      p.wheel.rotation.z -= dt * (0.13 + p.kick * 1.65);
      p.piston.position.y = 1.45 + Math.sin(t * 0.62) * (0.12 + p.kick * 0.17);
      p.bellJar.rotation.y = Math.sin(t * 0.23) * 0.08;
      p.light.intensity = 58 + Math.sin(t * 1.7) * 8 + p.kick * 24;
      p.naveLight.intensity = 24 + Math.sin(t * 0.74 + 1.2) * 4 + p.kick * 8;
    }
    if (state.sluice) {
      state.sluice.sprayKick = Math.max(0, state.sluice.sprayKick - dt * 1.7);
      state.sluice.highLight.intensity = 42 + Math.max(0, Math.sin(t * 2.25)) * 14
        + state.sluice.sprayKick * 34;
      state.sluice.midLight.intensity = 30 + Math.max(0, Math.sin(t * 1.77 + 0.35)) * 8
        + state.sluice.sprayKick * 18;
      state.sluice.lowerLight.intensity = 28 + Math.max(0, Math.sin(t * 1.31 + 0.8)) * 7
        + state.sluice.sprayKick * 12;
      for (let i = 0; i < state.sluice.runnels.length; i++) {
        state.sluice.runnels[i].position.y += Math.sin(t * 4.1 + i) * 0.00012;
      }
    }
    const player = game.player.pos;
    const choir = game.enemies?.choir;
    // THE DROP YOU JUST WATCHED LAND. The GPU owns the fall; the CPU only
    // re-evaluates the same wrap to place the tick. floor(u - fallFrac)
    // increments exactly at the landing, because the shader's splash begins at
    // fract(u) == fallFrac. 29 sites, one Math.floor each, per 1/120 step.
    // (Named DRIPS, not D: the displacement figure below already owns `const
    // D` in this same block scope, and two of them is a SyntaxError that would
    // take the whole game down at boot, not just the cave.)
    const DRIPS = state.drips;
    if (DRIPS) {
      DRIPS.cooldown -= dt;
      for (let i = 0; i < DRIPS.sites.length; i++) {
        const s = DRIPS.sites[i];
        const cycle = Math.floor(gt / s.period + s.phase - s.fallFrac);
        if (cycle === s.lastCycle) continue;
        // fire only on a true +1 step: entering the district and the t % 600
        // wrap both jump the index, and both must stay silent
        const stepped = s.lastCycle >= 0 && cycle === s.lastCycle + 1;
        s.lastCycle = cycle;
        if (!stepped || DRIPS.cooldown > 0) continue;
        const ddx = player.x - s.x, ddz = player.z - s.z;
        if (ddx * ddx + ddz * ddz > 36) continue;   // 6 m -- dial for chatter
        DRIPS.cooldown = 2.0;                       // dial for chatter
        // quieter and higher than the director's blind cave ecology on
        // purpose: that one is the far, unseen cave; this is the small drop
        // you just watched land two metres away.
        game.audio.caveDrip({ pos: s.landing, gain: 0.19, rate: 1.26, verb: 0.82 });
      }
    }
    for (let i = 0; i < state.sprayZones.length; i++) {
      const zone = state.sprayZones[i];
      const pulse = state.sprayPulse[i];
      const dx = player.x - zone.pos.x;
      const dz = player.z - zone.pos.z;
      const inside = dx * dx + dz * dz <= zone.radius * zone.radius;
      // A water volume is an authored beat, not an every-frame damage aura.
      // Crossing its edge fires one spatial pulse; leaving rearms it, while the
      // cooldown protects the Choir's localized reveal one-shot from chatter.
      let sprayed = false;
      if (inside && !pulse.inside && t >= pulse.nextAt) {
        game.enemies?.caveSpray?.(zone.pos, zone.radius, zone.strength);
        pulse.nextAt = t + 0.8;
        sprayed = true;
        if (state.sluice) state.sluice.sprayKick = 1;
      }
      // WATER ON THE LENS. Cosmetic only, and deliberately NOT a new spray
      // zone: adding one would change caveSpray's reveal cadence for the
      // Choir. It calls nothing on the enemies and reads nothing they own.
      if (inside && !pulse.inside) game.splashLens?.(0.55);
      if (inside) game.splashLens?.(dt * 0.6);
      pulse.inside = inside;
      // The Choir walks the player's own breadcrumbs through the same
      // curtains: its OWN crossing lights it (reveal + audio only — no slow,
      // no wash, no strike-cancel, so pursuit is bit-identical). A caveSpray
      // pulse this frame already revealed and voiced it; don't double-fire.
      const c = state.choirPulse[i];
      if (choir && choir.state !== 'spent') {
        const cdx = choir.pos.x - zone.pos.x;
        const cdz = choir.pos.z - zone.pos.z;
        const choirInside = cdx * cdx + cdz * cdz <= zone.radius * zone.radius;
        if (choirInside && !c.inside && t >= c.nextAt && !sprayed) {
          game.enemies?.drownedChoirDrench?.();
          c.nextAt = t + 0.8;
        }
        c.inside = choirInside;
      } else {
        // no choir (or spent): stay armed-as-inside so a source spawned inside
        // a curtain cannot self-reveal at birth — the warning stays audio-only
        c.inside = true;
      }
    }
    // EVERY curtain wets you now, not just the two that happen to be spray
    // zones. Six slab tests, about forty flops a step, no allocation.
    for (let i = 0; i < state.curtains.length; i++) {
      const c = state.curtains[i];
      const cdx = player.x - c.x, cdz = player.z - c.z;
      const along = cdx * c.tx + cdz * c.tz;
      const inCurtain = Math.abs(along) <= c.depth
        && Math.abs(cdx * c.tz - cdz * c.tx) <= c.half;
      const was = state.curtainInside[i];
      state.curtainInside[i] = inCurtain;
      if (!inCurtain) continue;
      // the burst is what makes a brisk walk-through read at all: crossing a
      // 1.8 m slab at walking pace is 0.6 s, and the top-up alone would only
      // bead the glass after you were already out the other side
      if (!was) game.splashLens?.(0.30);
      game.splashLens?.(dt * 0.35);
    }
    if (!state.beats.pump && player.distanceToSquared(state.pump.position) < 11.5 * 11.5) {
      state.beats.pump = true;
      state.pump.kick = 1;
      game.audio.stoneGrind({ pos: state.pump.position, gain: 0.54, rate: 0.52, verb: 0.88 });
      // The answering impact is beyond the room, spatially separate from the
      // machine the player can see.
      const answer = layout.sluiceRise;
      game.audio.metalDrop({ pos: new THREE.Vector3(answer.x + 3.2, answer.y + 1, answer.z), gain: 0.34, rate: 0.58, verb: 0.9 });
    }

    const high = layout.upperSluice;
    if (!state.beats.high && Math.hypot(player.x - high.x, player.z - high.z) < 6.5) {
      state.beats.high = true;
      const behind = layout.lowerSluice;
      game.audio.splash({ pos: new THREE.Vector3(behind.x - 2.6, behind.y + 2.2, behind.z), gain: 0.46, rate: 0.64, verb: 0.82 });
    }

    // THE BELL HANGS, AND IT IS THE ONE THING IN THIS DISTRICT YOU CAN MOVE.
    //
    // Alex, on the live build: "what is this, it doesn't move or do anything."
    // Round twelve answered by putting it on the floor, on a reason that was
    // not true (see buildBellCistern). Round thirteen answered the real half:
    // it had no ticker, no light of its own and no voice, and the one line in
    // the codebase that ever named it played metalDrop -- the room's only bell
    // making the sound of a dropped spanner. This round hangs it back up and
    // keeps the voice, and now the MOTION CAUSES THE SOUND instead of the
    // sound being decorated with motion afterwards.
    //
    // It cannot be a fetch target. The skull is gone by the time anyone stands
    // here (director.js waterfallTaken -> skull.vanish, "the waterfall. it does
    // not come back") and it never comes back in this act, so "hit it with the
    // skull" is not an answer that exists. What does exist is your own body:
    // walk into it and it swings, because it is hanging.
    //
    // The old fiction was not true either. buildCeilingDrips samples
    // layout.mainSegments ONLY; replayed offline, all 29 sites land on the main
    // route and the nearest one to this axis is 8.55 m away through rock, so
    // "water off the broken vault finds the iron" described something the
    // geometry does not contain, and the caveDrip that used to fire with each
    // toll was a sound with no drop. It is gone. The bell is DRY -- that is the
    // whole point of the room -- and what moves it is the draught, in a
    // district that is open at both ends.
    const S = state.secret;
    // Discovery keeps its radius and its flag untouched -- tests/underfalls-
    // expansion.mjs walks to this node and asserts both -- but it arrives now
    // as a gust and a toll rather than as a dropped spanner. The gust is a
    // velocity change, not a position change, so nothing snaps.
    if (!S.discovered && player.distanceToSquared(S.position) < 3.05 * 3.05) {
      S.discovered = true;
      game.flag('underfallsSecret');
      const dax = S.axis.x - player.x, daz = S.axis.z - player.z;
      const far = Math.hypot(dax, daz) || 1;
      S.avx += BELL_GUST * (dax / far);
      S.avz += BELL_GUST * (daz / far);
      S.glow = 1;
      S.tollCd = BELL_TOLL_GAP;
      game.audio.bellRing({ pos: S.strikePos, gain: 0.23, rate: 0.33, verb: BELL_VERB, dark: true });
    }
    if (S.pivot) {
      // THE DRAUGHT. The same cadence array round thirteen tolled on, doing a
      // different job: it delivers a nudge, not a sound. Fixed array, no
      // Math.random and no setTimeout, so a playthrough stays bit-identical.
      S.gustT -= dt;
      if (S.gustT <= 0) {
        const cadence = [7.3, 11.6, 9.1, 13.8];
        S.gustT = cadence[S.gustIndex % cadence.length];
        const bearing = S.gustIndex * 2.399963;    // golden angle: never repeats
        S.avx += BELL_GUST * Math.cos(bearing);
        S.avz += BELL_GUST * Math.sin(bearing);
        S.gustIndex++;
      }
      // AND YOUR SHOULDER. The collider holds you 0.96 m off the axis on a face
      // and 1.217 m on a corner, so contact is a ring rather than a point;
      // player.vel is smoothed INTENT, so it stays live while the box holds you
      // and leaning keeps feeding the swing. The crown goes AWAY from you,
      // which is the only direction a shove can send it.
      const px = player.x - S.axis.x, pz = player.z - S.axis.z;
      const reach = Math.hypot(px, pz);
      if (reach > 1e-4 && reach < BELL_CONTACT) {
        const into = -(game.player.vel.x * px + game.player.vel.z * pz) / reach;
        if (into > 0.4) {
          S.avx -= BELL_PUSH * into * (px / reach) * dt;
          S.avz -= BELL_PUSH * into * (pz / reach) * dt;
        }
      }
      // Small-angle pendulum about the chain's apex on the fixed 1/120 step.
      // L is apex to the lathe's surface-of-revolution centroid (local y 0.948)
      // = 2.882 m, so g/L is 3.4045 and the period is 3.405 s: a two-tonne
      // thing, not a wind chime. Damping 0.14 is a 14.4 s e-fold, so it never
      // quite stops and it is still moving when you leave the room.
      S.avx -= (BELL_W2 * Math.sin(S.ax) + BELL_DAMP * S.avx) * dt;
      S.avz -= (BELL_W2 * Math.sin(S.az) + BELL_DAMP * S.avz) * dt;
      S.ax += S.avx * dt;
      S.az += S.avz * dt;
      // ONE CAP, ON ENERGY, and it is what keeps the iron out of the player.
      // For a harmonic swing the amplitude is hypot(lean, speed / w), and at
      // BELL_MAX the widest iron any reachable head window can hold reaches
      // 0.608 m -- 0.014 m short of the BELL_HALF box, measured against this
      // chamber's own sloping floor rather than against the node. Scaling all
      // four terms caps it without the jolt that clamping the angle alone gives.
      const amp = Math.hypot(
        Math.hypot(S.ax, S.az), Math.hypot(S.avx, S.avz) / BELL_W,
      );
      if (amp > BELL_MAX) {
        const k = BELL_MAX / amp;
        S.ax *= k; S.az *= k; S.avx *= k; S.avz *= k;
      }
      // THE TOLL IS A CONSEQUENCE, NOT A TIMER. The clapper is loose in the
      // crown of an upturned bell, so it strikes at the BOTTOM of the swing
      // where the bell is fastest: the instant the lean stops shrinking and
      // starts growing again. A bell circling smoothly never gets there, which
      // is right -- a resting clapper needs a reversal to be thrown.
      const lean2 = S.ax * S.ax + S.az * S.az;
      S.tollCd -= dt;
      if (lean2 < S.prevLean2) S.towardCentre = true;
      else if (S.towardCentre) {
        S.towardCentre = false;
        if (amp >= BELL_TOLL && S.tollCd <= 0) {
          // EARSHOT IS MEMBERSHIP, NOT A RADIUS -- round thirteen's rule kept
          // verbatim. A 22 m circle around the strike point reaches the MAIN
          // route at 8.06 m and covers most of the chapel-to-upper-sluice run
          // through solid rock: a secret calling attention to itself along the
          // public road, which inverts law 6. projectUnderfalls answers
          // 'secret' only inside the culvert and the cistern, and the chapel's
          // r 10.5 disc owns the first two culvert legs, so the bell opens
          // 6.49 m short of itself and sounds nowhere on the main route.
          //
          // Round thirteen paid for that query on EVERY cave frame. Asking it
          // here instead -- at a swing reversal, about 0.6 times a second and
          // only when the amplitude and the cooldown already agree -- is the
          // same answer for a fraction of the calls.
          const where = projectUnderfalls(layout, player.x, player.z);
          if (where && where.kind === 'secret' && where.clearance <= 0) {
            S.tollCd = BELL_TOLL_GAP;
            // An inelastic strike: the swing PAYS for the sound. This is what
            // holds the ambient rate at one toll per 20.7 s against round
            // thirteen's 10.45 s mean, with no timer saying so -- and it is why
            // leaning on the bell for twenty seconds still only produced a toll
            // every 10.4 s in simulation, never reaching the 7.3 s floor.
            S.avx *= 0.55; S.avz *= 0.55;
            S.glow = 1;
            game.audio.bellRing({
              pos: S.strikePos, gain: 0.17 + (S.gustIndex % 3) * 0.015,
              rate: 0.33, verb: BELL_VERB, dark: true,
            });
          }
        }
      }
      S.prevLean2 = lean2;
      // Rotation about the apex: +ax leans the crown toward +x, +az toward +z
      // (three.js sends a point below the pivot toward -z for a positive x
      // rotation, hence the sign). At the cap the crown travels 0.421 m
      // peak-to-peak and the pale rim -- the only part of this object a dark
      // room leaves you -- travels 0.263 m, against round thirteen's 0.250.
      // Value and motion carry the read; no part of it is hue.
      S.pivot.rotation.z = S.ax;
      S.pivot.rotation.x = -S.az;
      // The clapper lags the bell and slides to the low side. 0.045 m of
      // travel: the lathe's inner radius at the clapper's height is 0.287 and
      // the clapper is 0.24, so it has 0.047 m before it pushes out through the
      // bell's own wall. The scale puts it exactly at the wall at the angular
      // speed a toll fires on, so the picture and the sound agree.
      S.clapper.position.x = clamp(-S.avx * 0.87, -0.045, 0.045);
      S.clapper.position.z = clamp(-S.avz * 0.87, -0.045, 0.045);
      S.glow = Math.max(0, S.glow - dt * 0.34);
      S.light.intensity = 13.5 + S.glow * 10.5;
    }

    // Hear displaced spray before it owns a silhouette. It never attacks,
    // blocks, or changes controls; it is a wrong answer to "what moved the
    // water?" and leaves before the upper gallery.
    const D = state.displacement;
    const chapelD = Math.hypot(player.x - layout.chapel.x, player.z - layout.chapel.z);
    if (!D.heard && chapelD < 15) {
      D.heard = true;
      D.t = -0.85;
      game.audio.splash({ pos: D.positions[0], gain: 0.3, rate: 0.72, verb: 0.9 });
    }
    if (D.heard && !D.revealed) {
      D.t += dt;
      if (D.t >= 0) {
        D.revealed = true;
        D.root.visible = true;
      }
    }
    if (D.revealed) {
      game.camera.getWorldPosition(cameraPos);
      game.camera.getWorldDirection(cameraDir);
      const to = D.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)).sub(cameraPos);
      const d = to.length();
      const seen = d > 0.01 && to.multiplyScalar(1 / d).dot(cameraDir) > 0.76;
      const nearHigh = player.y > 2.25 || player.z > layout.upperSluice.z - 2;
      D.mat.opacity = lerp(D.mat.opacity, nearHigh ? 0 : (seen ? 0.37 : 0.16), Math.min(1, dt * 4.2));
      if (!seen && D.index < D.positions.length - 1 && d < 9.5 && D.t > 1.4) {
        D.index++;
        D.root.position.copy(D.positions[D.index]);
        D.t = 0;
        game.audio.splash({ pos: D.root.position, gain: 0.24, rate: 0.82 + D.index * 0.08, verb: 0.92 });
      } else D.t += dt;
      if (nearHigh && D.mat.opacity < 0.01) D.root.visible = false;
    }
  });
}

export function buildUnderfalls(game) {
  const { world, scene } = game;
  const renderStart = scene.children.length;
  const layout = createUnderfallsLayout(game.clearingCenter);
  const state = {
    id: 'underfalls',
    layout,
    lights: [],
    lightsActive: false,
    beats: { pump: false, high: false },
    sprayZones: layout.sprayZones,
    sprayPulse: layout.sprayZones.map(() => ({ inside: false, nextAt: 0 })),
    // the CHOIR's own zone edges, tracked separately: its crossings reveal it
    // without touching the player-pulse semantics above
    choirPulse: layout.sprayZones.map(() => ({ inside: false, nextAt: 0 })),
    // the drawn water sheets you physically walk through, and one edge flag
    // each so a crossing beads the lens once instead of every step inside
    curtains: layout.curtains,
    curtainInside: layout.curtains.map(() => false),
    groundAt(x, z) { return underfallsGroundAt(layout, x, z); },
    contains(x, z, pad = 0) { return underfallsContains(layout, x, z, pad); },
    project(x, z) { return projectUnderfalls(layout, x, z); },
    projectMain(x, z) { return projectUnderfallsMain(layout, x, z); },
    mainPointAt(d) { return underfallsMainPointAt(layout, d); },
    lineOfSight(a, b, options) { return underfallsLineOfSight(layout, a, b, options); },
    route(a, b, options) { return findUnderfallsRoute(layout, a, b, options); },
  };
  game.underfalls = state;

  const b = layout.bounds;
  game.caveZone = world.addZone('cave', b.minX, b.minZ, b.maxX, b.maxZ, -4, 14);
  game.caveZone.enabled = game.flags.has('waterfallTaken');
  world.addSurface('stone', b.minX, b.minZ, b.maxX, b.maxZ, -4, 14);

  addFloorAndShell(game, layout);
  buildRouteLights(game, layout, state);
  buildPumpChapel(game, layout, state);
  buildSluice(game, layout, state);
  buildBellCistern(game, layout, state);
  buildSprayDisplacement(game, layout, state);
  buildPathSheen(game, layout, state);
  buildLowSteam(game, layout, state);
  buildCeilingDrips(game, layout, state);
  buildHatchCistern(game, layout, state);
  // The district exists under the exterior coordinates, but none of its
  // chapel, sluice, hatch or spray geometry belongs in an exterior render.
  // Remember each root's live visibility so one-shot cave beats survive a
  // leave/re-entry, then remove the whole district until the cave act begins.
  // Lights are excluded: they are already owned by state.lights below, and
  // they are the one kind of child whose scene-graph visibility is not a
  // rendering decision. The shader light census is pinned (see
  // World.pinLightCensus), so a district light sleeps by going black and stays
  // resident — leaving it in a list called renderRoots would both
  // double-manage it and make "how much of the cave is drawn" uncountable.
  state.renderRoots = scene.children.slice(renderStart).filter((root) => !root.isLight);
  state.renderVisibility = new Map(state.renderRoots.map((root) => [root, root.visible]));
  state.renderActive = false;
  for (const root of state.renderRoots) root.visible = false;
  for (const light of state.lights) light.visible = false;
  installClamp(game, layout, state);
  installCaveVisibility(game, state);
  installBeats(game, layout, state);
  return state;
}

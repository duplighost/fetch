// underfalls.js — the skull-less district behind the waterfall.
//
// Contract: this module owns the cave's route math, structural geometry,
// progression-neutral horror beats, and hatch. outside.js mounts it; the
// atmosphere pass reads the exported layout to dress the exact same space.
// Every floor sample and lateral clamp comes from one route description so a
// beautiful ledge can never secretly be a hole.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, TAU } from './util.js';

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
      world.box(M.rock, x, y - 0.11, z, w * 2.0, 0.22, seg.length / n + 0.08, yaw);
    }
    const opensIntoChamber = layout.chambers.some((chamber) =>
      Math.hypot(seg.a.x - chamber.x, seg.a.z - chamber.z) < chamber.r * 0.94
      || Math.hypot(seg.b.x - chamber.x, seg.b.z - chamber.z) < chamber.r * 0.94);
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
    if (opensIntoChamber) continue;
    // Structural backing behind the later low-poly rock skin. It is deliberately
    // not an AABB collider: diagonal wall boxes were the old forest trap bug.
    world.box(M.rock,
      (seg.a.x + seg.b.x) * 0.5 + nx * (avgW + 0.42), avgY + 2.35,
      (seg.a.z + seg.b.z) * 0.5 + nz * (avgW + 0.42),
      0.54, 5.15, seg.length + 1.1, yaw);
    world.box(M.rock,
      (seg.a.x + seg.b.x) * 0.5 - nx * (avgW + 0.42), avgY + 2.35,
      (seg.a.z + seg.b.z) * 0.5 - nz * (avgW + 0.42),
      0.54, 5.15, seg.length + 1.1, yaw);
  }

  // THE WET LINE. One pale, slightly raised ribbon runs the whole MAIN route
  // and none of the culvert: the way forward is the wet way, told in value
  // and geometry, never in hue. This is the single strongest answer to
  // Alex's "just has you walking through rocks and random things" — the
  // route now draws itself on the floor. One cloned material = one draw
  // call for the entire ribbon (world.box merges by material).
  const wetStone = M.headstone.clone();
  wetStone.userData.underfalls = true;   // cave visibility keeps tagged materials
  // This must survive the stretches between fixtures: it is reflected wet
  // stone, not a coloured breadcrumb. A higher value, wider shoulder and a
  // restrained emissive floor keep the next physical tread present in every
  // vista while the unmarked culvert remains genuinely dark.
  wetStone.color.setHex(0xbcc8ca);
  if ('roughness' in wetStone) wetStone.roughness = 0.16;
  if ('emissive' in wetStone) {
    wetStone.emissive = new THREE.Color(0x394548);
    wetStone.emissiveIntensity = 0.72;
  }
  for (const seg of layout.mainSegments) {
    const n = Math.max(2, Math.ceil(seg.length / 0.9));
    const yaw = Math.atan2(seg.dx, seg.dz);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const w = lerp(seg.a.w, seg.b.w, t);
      world.box(wetStone,
        lerp(seg.a.x, seg.b.x, t), lerp(seg.a.y, seg.b.y, t) + 0.012,
        lerp(seg.a.z, seg.b.z, t),
        2 * clamp(w * 0.46, 0.94, 1.72), 0.06, (seg.length / n + 0.08) * 0.98, yaw);
    }
  }

  // Chamber floors are broad and honest. Each used to be one big SQUARE slab
  // at r*1.72 while the walkable clamp is a DISC of radius r: at the chapel
  // that meant over two metres of visible floor you could not walk on at the
  // corners, and rim gaps of invisible floor at the edge midpoints — "random
  // things" in floor form. One instanced sixteen-gon disc per chamber now
  // matches the clamp within 2%, with no coplanar overlaps to shimmer.
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
      const off = b.w + 1.1;
      marks.push({
        x: b.x + bis.x * off, y: b.y, z: b.z + bis.y * off,
        h: 4.2 + Math.min(1.0, (turn - 45) / 90),
      });
    }
    if (marks.length) {
      const geo = new THREE.ConeGeometry(0.34, 1, 6);
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

  // 2. Paired pale jambs where the main route crosses a chamber rim: rooms
  //    get doorways, so entering and leaving one reads as an event.
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
          for (const side of [-1, 1]) {
            jambs.push({ x: x + nx * side * (w + 0.55), y, z: z + nz * side * (w + 0.55) });
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
    }
  }
}

function addColliderCylinder(world, x, z, r, y0, y1, role) {
  return world.addCollider(x - r, y0, z - r, x + r, y1, z + r,
    { underfalls: true, role });
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
      addColliderCylinder(world, x, z, 0.54, -0.5, 3.2, 'pump chapel pillar');
      ribMatrices.push(transformMatrix(
        x - nx * side * 1.35, h + 0.25, z - nz * side * 1.35,
        0, aisleYaw, side * 0.75, 1, 4.5 * (row === 1 ? 0.72 : 1), 1));
    }
  }
  addInstances(group, new THREE.CylinderGeometry(0.45, 0.63, 1, 7), wetStone, pillarMatrices,
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
  addColliderCylinder(world, altarX, altarZ, 1.28, -0.4, 1.1, 'pump altar');
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

  const benchMatrices = [];
  const legMatrices = [];
  for (let row = -2; row <= 1; row++) {
    const along = row * 3.0 + 0.8;
    for (const side of [-1, 1]) {
      const x = C.x + tx * along + nx * side * 3.55;
      const z = C.z + tz * along + nz * side * 3.55;
      const routeDistance = Math.min(...layout.segments.map((seg) => segmentProjection(seg, x, z).d));
      if (routeDistance < 1.18) continue;
      const benchMatrix = transformMatrix(x, 0.48, z,
        0, aisleYaw + (side < 0 ? Math.PI : 0), side * 0.035, 2.35, 0.18, 0.58);
      benchMatrices.push(benchMatrix);
      // Thin crooked legs make them read as furniture while remaining ordinary
      // step-height clutter, never another invisible wall.
      for (const d of [-0.78, 0.78]) {
        const local = transformMatrix(d / 2.35, -0.29 / 0.18, 0, 0, 0, 0,
          0.12 / 2.35, 0.48 / 0.18, 0.12 / 0.58);
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
    treadMatrices.push(transformMatrix(s.x, s.y + 0.018, s.z,
      0, yaw, 0, s.w * 1.65, 0.11, 0.76));
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
    for (const side of [-1, 1]) {
      // posts stood at w-0.455 to their inner face — inside the clamp, so
      // the player brushed through iron. They frame the lane now, not block it.
      postMatrices.push(gateMatrix.clone().multiply(transformMatrix(
        side * (p.w + 0.12), 1.9, 0, 0, 0, 0, 0.23, 3.85, 0.28)));
    }
    topMatrices.push(gateMatrix.clone().multiply(transformMatrix(
      0, 3.72, 0, 0, 0, 0, p.w * 2.1, 0.25, 0.36)));
    toothMatrices.push(gateMatrix.clone().multiply(transformMatrix(
      0, 2.15 + (index & 1) * 0.55, 0,
      0, 0, (index & 1 ? 1 : -1) * 0.05, p.w * 1.45, 0.11, 0.28)));
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
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), iron);
  bell.position.set(C.x, C.y + 1.18, C.z);
  bell.castShadow = true;
  group.add(bell);
  const bellRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.075, 7, 24), pale);
  bellRim.position.set(C.x, C.y + 2.62, C.z);
  bellRim.rotation.x = Math.PI / 2;
  group.add(bellRim);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), iron);
  clapper.position.set(C.x, C.y + 1.46, C.z);
  group.add(clapper);
  const snapped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.8, 5), iron);
  snapped.position.set(C.x + 0.48, C.y + 3.45, C.z - 0.2);
  snapped.rotation.z = 0.55;
  group.add(snapped);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 0.75), M.woodDark);
  shelf.position.set(C.x - 1.8, C.y + 0.72, C.z + 2.0);
  shelf.rotation.y = 0.28;
  group.add(shelf);
  const lost = { ringPale: [], ringIron: [], rodPale: [], rodIron: [] };
  for (let i = 0; i < 13; i++) {
    const ring = i % 3 === 0;
    const paleObject = i % 4 === 0;
    const scale = ring ? (0.11 + (i % 2) * 0.035) / 0.11 : 1;
    const height = ring ? scale : 0.42 + (i % 4) * 0.08;
    const matrix = transformMatrix(
      C.x - 3.1 + i * 0.23, C.y + 0.88 + (i % 2) * 0.035,
      C.z + 1.85 + Math.sin(i * 2.3) * 0.18,
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
  const dryRing = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.28, 28),
    new THREE.MeshBasicMaterial({ color: 0xa6b0ad, transparent: true, opacity: 0.27, side: THREE.DoubleSide }));
  dryRing.rotation.x = -Math.PI / 2;
  dryRing.position.set(C.x, C.y + 0.025, C.z);
  group.add(dryRing);
  world.candles.push({ x: C.x - 2.4, y: C.y + 1.05, z: C.z + 1.8, intensity: 1.25, r: 4.5 });
  const bellLight = new THREE.PointLight(0xd7a468, 13.5, 12, 1.15);
  markUnderfalls(bellLight);
  bellLight.position.set(C.x - 0.6, C.y + 2.25, C.z + 0.5);
  scene.add(bellLight);
  state.lights.push(bellLight);
  state.secret = { group, bell, clapper, position: new THREE.Vector3(C.x, C.y, C.z), discovered: false };
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

function buildHatchCistern(game, layout, state) {
  const { world, scene, mats: M } = game;
  const H = layout.hatch;
  const y = H.y;
  const r = 4.0;
  world.box(M.rock, H.x, y - 0.15, H.z, r * 2, 0.3, r * 2);
  world.box(M.rock, H.x + r, y + 2.0, H.z, 0.8, 4.5, r * 2);
  world.box(M.rock, H.x - r, y + 2.0, H.z, 0.8, 4.5, r * 2);
  world.box(M.rock, H.x, y + 2.0, H.z + r, r * 2, 4.5, 0.8);
  world.box(M.rock, H.x, y + 4.15, H.z, r * 2 + 0.4, 0.5, r * 2 + 0.4);
  world.addCollider(H.x + r - 0.4, y - 1, H.z - r, H.x + r + 0.4, y + 4, H.z + r,
    { underfalls: true, role: 'hatch chamber wall' });
  // Southwest stays open: the descending spill arrives diagonally through that
  // corner. The route union is already the reliable outer boundary, so an AABB
  // here would only counterfeit a wall across the authored entrance.
  world.addCollider(H.x - r, y - 1, H.z + r - 0.4, H.x + r, y + 4, H.z + r + 0.4,
    { underfalls: true, role: 'hatch chamber wall' });

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
  const chainMatrices = [];
  for (let side = -1; side <= 1; side += 2) {
    const links = side < 0 ? 8 : 6;
    for (let i = 0; i < links; i++) {
      chainMatrices.push(transformMatrix(side * 0.46, 3.42 - i * 0.23, 0.38,
        0, (i & 1) * Math.PI / 2, 0, 0.72, 0.72, 0.72));
    }
  }
  addInstances(hatch, new THREE.TorusGeometry(0.12, 0.022, 5, 10), hatchMetal, chainMatrices,
    { name: 'mismatched hatch pull chains' });
  // "the thing at the end should be more visible with a handle" — the same
  // handle language as every other thing you can open: a bar and brackets
  // on the door's underside, facing the upturned player.
  const hatchHandleMat = new THREE.MeshStandardMaterial({
    color: 0x22282a, roughness: 0.4, metalness: 0.7,
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
    || (child.isMesh && child.material === game.mats.rock)
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
  game.tickers.push((dt, t) => {
    const inCave = game.act === 'cave';
    if (state.renderActive !== inCave) {
      if (inCave) {
        for (const root of state.renderRoots || []) {
          root.visible = state.renderVisibility?.get(root) !== false;
        }
      } else {
        for (const root of state.renderRoots || []) {
          state.renderVisibility?.set(root, root.visible);
          root.visible = false;
        }
      }
      state.renderActive = inCave;
    }
    if (state.lightsActive !== inCave) {
      state.lightsActive = inCave;
      for (const light of state.lights) light.visible = inCave;
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
    for (let i = 0; i < state.sprayZones.length; i++) {
      const zone = state.sprayZones[i];
      const pulse = state.sprayPulse[i];
      const dx = player.x - zone.pos.x;
      const dz = player.z - zone.pos.z;
      const inside = dx * dx + dz * dz <= zone.radius * zone.radius;
      // A water volume is an authored beat, not an every-frame damage aura.
      // Crossing its edge fires one spatial pulse; leaving rearms it, while the
      // cooldown protects the Choir's localized reveal one-shot from chatter.
      if (inside && !pulse.inside && t >= pulse.nextAt) {
        game.enemies?.caveSpray?.(zone.pos, zone.radius, zone.strength);
        pulse.nextAt = t + 0.8;
        if (state.sluice) state.sluice.sprayKick = 1;
      }
      pulse.inside = inside;
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

    if (!state.secret.discovered && player.distanceToSquared(state.secret.position) < 3.05 * 3.05) {
      state.secret.discovered = true;
      game.flag('underfallsSecret');
      game.audio.metalDrop({ pos: state.secret.position.clone().add(new THREE.Vector3(0, 2.4, 0)), gain: 0.36, rate: 0.44, verb: 0.95 });
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
    groundAt(x, z) { return underfallsGroundAt(layout, x, z); },
    contains(x, z, pad = 0) { return underfallsContains(layout, x, z, pad); },
    project(x, z) { return projectUnderfalls(layout, x, z); },
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

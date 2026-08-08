// audit-furnishings.mjs — the furniture-vs-openings audit (PLAYTEST-2 lane).
// Statically checks every K.* placement in house.js furnish() against the
// HOUSE_TABLES door/window holes, wall segments, stairs and shafts, using the
// same edge model as world.js buildHouse. Pure analysis: no browser, no game.
//   node tools/audit-furnishings.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'src/house.js'), 'utf8');

// ---- world.js constants (keep in sync) ----
const CS = 2, WALL_T = 0.26, EXT_T = 0.4, DOOR_W = 1.3, DOOR_H = 2.25, WIN_W = 1.4;

// ---- extract HOUSE_TABLES (pure data literal) ----
const tStart = src.indexOf('export const HOUSE_TABLES = {');
const tEnd = src.indexOf('\n};', tStart);
const T = new Function('return ' + src.slice(tStart + 'export const HOUSE_TABLES = '.length, tEnd + 2))();
const [OX, OZ] = T.origin;
const wx = (cx) => OX + cx * CS;
const wz = (cz) => OZ + cz * CS;

// ---- cell -> room maps + wall segments (edge exists where rooms differ) ----
const cellMaps = {};
for (const lv of Object.keys(T.levels)) cellMaps[lv] = new Map();
for (const [id, x0, z0, x1, z1, lv] of T.rooms)
  for (let cx = x0; cx <= x1; cx++)
    for (let cz = z0; cz <= z1; cz++) cellMaps[lv].set(cx + ',' + cz, id);

const wallAt = (lv, orient, ex, ez) => {   // does a wall segment exist on this edge cell?
  const cells = cellMaps[lv];
  const a = orient === 'H' ? cells.get(ex + ',' + (ez - 1)) : cells.get((ex - 1) + ',' + ez);
  const b = cells.get(ex + ',' + ez);
  if (a === undefined && b === undefined) return null;
  if (a === b) return null;
  return { exterior: !a || !b, t: (!a || !b) ? EXT_T : WALL_T };
};

const edgeOf = (cx, cz, dir) => {
  if (dir === 'N') return ['H', cx, cz];
  if (dir === 'S') return ['H', cx, cz + 1];
  if (dir === 'W') return ['V', cx, cz];
  return ['V', cx + 1, cz];
};

// ---- door/window holes in world space ----
// H edge: plane z = wz(ez), span x [wx(ex), wx(ex)+CS]; V edge: plane x = wx(ex)
const holes = [];
for (const [kind, list] of [['door', T.doors], ['window', T.windows]]) {
  for (const [lv, cx, cz, dir, opts = {}] of (list || [])) {
    const [o, ex, ez] = edgeOf(cx, cz, dir);
    const floor = T.levels[lv].floor;
    const w = opts.w || (kind === 'door' ? DOOR_W : WIN_W);
    const axisMid = (o === 'H' ? wx(ex) : wz(ez)) + CS / 2;
    holes.push({
      kind, lv, dir, id: opts.id || `${kind}@${lv}:${cx},${cz},${dir}`,
      orient: o, plane: o === 'H' ? wz(ez) : wx(ex),
      a: axisMid - w / 2, b: axisMid + w / 2,
      y0: kind === 'door' ? floor : floor + (opts.sill != null ? opts.sill : 1.0),
      y1: kind === 'door' ? floor + (opts.h || DOOR_H) : floor + 2.6,
    });
  }
}

// ---- parse furnishing calls out of furnish() ----
const fStart = src.indexOf('function furnish(game) {');
const fEnd = src.indexOf('\n// ----', fStart);
const body = src.slice(fStart, fEnd);
const CALL_RE = /K\.(\w+)\(([^;]*)\);?/g;
const evalArg = (s) => {
  try { return new Function('F', 'G', 'B', 'Math', `return (${s});`)(3.6, 0, -3.0, Math); }
  catch { return null; }
};
const splitArgs = (s) => {   // split top-level commas
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

// footprint catalog: [halfX, halfZ, height, kind] in LOCAL space (before ry),
// arg layout per kit signature. kind: floor | flat | wall | skip
const CATALOG = {
  rug:          (a) => ({ kind: 'flat' }),
  bed:          (a) => fp((a[4] ?? 1.55) + 0.15, (a[5] ?? 2.15) + 0.15, 1.7, a[3] ?? 0),
  wardrobe:     (a) => fp((a[4] ?? 1.42) + 0.14, 0.78, (a[5] ?? 2.18), a[3] ?? 0),
  dresser:      (a) => fp((a[4] ?? 1.25) + 0.08, 0.58, (a[5] ?? 0.94), a[3] ?? 0),
  nightstand:   (a) => fp(0.66, 0.58, 0.62, a[3] ?? 0),
  table:        (a) => fp((a[3] ?? 1.5), (a[4] ?? 0.85), (a[6] ?? 0.78) + 0.08, a[5] ?? 0),
  chair:        (a) => fp(0.52, 0.5, 0.98, a[3] ?? 0),
  rockingChair: (a) => fp(0.9, 0.62, 1.05, a[3] ?? 0),
  crib:         (a) => fp(1.48, 0.92, 1.25, a[3] ?? 0),
  sofa:         (a) => fp((a[4] ?? 2.15), 0.92, 0.95, a[3] ?? 0),
  bookshelf:    (a) => fp((a[4] ?? 1.5) + 0.1, 0.56, (a[5] ?? 2.08), a[3] ?? 0),
  desk:         (a) => fp(1.55, 0.8, 0.85, a[3] ?? 0),
  consoleTable: (a) => fp((a[4] ?? 1.15), 0.42, 0.86, a[3] ?? 0),
  counter:      (a) => fp(0.72, (a[4] ?? 3.4) + 0.06, 1.0, a[3] ?? 0),
  stove:        (a) => fp(0.95, 0.76, 1.75, a[3] ?? 0),
  fireplace:    (a) => fp(2.12, 0.66, 1.56, a[3] ?? 0),
  coatStand:    (a) => fp(0.9, 0.9, 1.9, 0),
  shelf:        (a) => fp((a[4] ?? 2.3), 0.54, (a[5] ?? 1.75), a[3] ?? 0),
  crate:        (a) => fp((a[4] ?? 0.74) + 0.04, (a[4] ?? 0.74) + 0.04, (a[4] ?? 0.74) * 0.78, a[3] ?? 0),
  barrel:       (a) => fp(0.66, 0.66, 0.88, a[3] ?? 0),
  boiler:       (a) => fp(1.05, 1.05, 2.5, a[3] ?? 0),
  waterTank:    (a) => fp(0.7, 0.7, 2.1, 0),
  framedArt:    (a) => wall((a[5] ?? 0.68) + 0.14, (a[6] ?? 0.88) + 0.15, a[3] ?? 0),
  blackMirror:  (a) => wall((a[4] ?? 0.74) + 0.15, (a[5] ?? 1.25) + 0.15, a[3] ?? 0),
  curtains:     (a) => wall((a[4] ?? 1.8) + 0.5, (a[5] ?? 2.25) + 0.3, a[3] ?? 0, true),
  oilLamp: () => ({ kind: 'skip' }), book: () => ({ kind: 'skip' }),
  paper: () => ({ kind: 'skip' }), plate: () => ({ kind: 'skip' }), bottle: () => ({ kind: 'skip' }),
};
function fp(w, d, h, ry) { return { kind: 'floor', w, d, h, ry }; }
function wall(span, h, ry, isCurtain = false) { return { kind: 'wall', span, h, ry, isCurtain }; }

const levelOf = (y) => {
  for (const [lv, { floor, ceil }] of Object.entries(T.levels))
    if (y >= floor - 0.4 && y <= ceil + 0.3) return lv;
  return null;
};

// rotated rect -> world AABB
const aabbOf = (x, z, w, d, ry) => {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  const hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2;
  return { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
};
const overlap1d = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

const items = [];
let m, line = 0;
for (const [i, l] of src.split('\n').entries()) void i;
while ((m = CALL_RE.exec(body))) {
  const [call, fn, argStr] = m;
  const srcLine = src.slice(0, fStart + m.index).split('\n').length;
  if (!CATALOG[fn]) continue;
  const args = splitArgs(argStr).map(evalArg);
  if (args.slice(0, 3).some((v) => typeof v !== 'number')) {
    items.push({ fn, srcLine, call: call.trim(), skip: 'tabletop/uneval' });
    continue;
  }
  const [x, y, z] = args;
  const spec = CATALOG[fn](args);
  if (spec.kind === 'skip' || spec.kind === 'flat') continue;
  items.push({ fn, srcLine, call: call.trim().slice(0, 90), x, y, z, ...spec, lv: levelOf(y) });
}

// ---- checks ----
const flags = [];
const flag = (item, code, detail) =>
  flags.push({ code, fn: item.fn, line: item.srcLine, call: item.call, detail });

for (const it of items) {
  if (it.skip || !it.lv) continue;
  const floor = T.levels[it.lv].floor;

  if (it.kind === 'wall') {
    // orientation: ry ~ 0/PI faces ±z -> mounted on H wall; ry ~ ±PI/2 -> V wall
    const ryMod = ((it.ry % Math.PI) + Math.PI) % Math.PI;
    const onH = ryMod < Math.PI / 4 || ryMod > (3 * Math.PI) / 4;
    const planes = new Set();
    for (let e = 0; e <= 14; e++) planes.add(onH ? wz(e) : wx(e));
    const my = onH ? it.z : it.x;
    const axisPos = onH ? it.x : it.z;
    let plane = null;
    for (const p of planes) if (Math.abs(my - p) < 0.35 && (plane === null || Math.abs(my - p) < Math.abs(my - plane))) plane = p;
    if (plane === null) { flag(it, 'FLOATING', `not within 0.35m of any ${onH ? 'z' : 'x'} wall plane (at ${my.toFixed(2)})`); continue; }

    const a = axisPos - it.span / 2, b = axisPos + it.span / 2;
    // wall segment existence across the covered cells
    const eFixed = onH ? Math.round((plane - OZ) / CS) : Math.round((plane - OX) / CS);
    for (let cell = Math.floor((a - (onH ? OX : OZ)) / CS); cell <= Math.floor((b - 0.01 - (onH ? OX : OZ)) / CS); cell++) {
      const seg = onH ? wallAt(it.lv, 'H', cell, eFixed) : wallAt(it.lv, 'V', eFixed, cell);
      if (!seg) { flag(it, 'NO-WALL', `hangs over a missing wall segment (cell ${cell} of ${onH ? 'z' : 'x'}=${plane} plane)`); break; }
    }
    // hole overlap on this edge
    const y0 = it.fn === 'curtains' ? it.y : it.y - it.h / 2;
    const y1 = it.fn === 'curtains' ? it.y + it.h : it.y + it.h / 2;
    let overWindow = false;
    for (const h of holes) {
      if (h.lv !== it.lv || h.orient !== (onH ? 'H' : 'V') || Math.abs(h.plane - plane) > 0.01) continue;
      const ox = overlap1d(a, b, h.a, h.b);
      const oy = overlap1d(y0, y1, h.y0, h.y1);
      if (ox > 0.05 && oy > 0.05) {
        if (it.isCurtain && h.kind === 'window') { overWindow = true; continue; }
        flag(it, 'OVER-HOLE', `overlaps ${h.kind} '${h.id}' by ${ox.toFixed(2)}m x ${oy.toFixed(2)}m`);
      }
    }
    if (it.isCurtain && !overWindow) flag(it, 'ORPHAN-CURTAIN', `no window on plane ${onH ? 'z' : 'x'}=${plane} under its span`);
    continue;
  }

  // floor furniture
  const bb = aabbOf(it.x, it.z, it.w, it.d, it.ry || 0);

  for (const h of holes) {
    if (h.lv !== it.lv) continue;
    const isBedWin = h.id === 'bedroomWindow';
    const deep = h.kind === 'door' ? 0.9 : (isBedWin ? 0.9 : 0.55);
    if (h.kind === 'window' && !isBedWin && it.h <= 1.0) continue;   // low pieces under windows are fine
    const zone = h.orient === 'H'
      ? { x0: h.a - 0.15, x1: h.b + 0.15, z0: h.plane - deep, z1: h.plane + deep }
      : { x0: h.plane - deep, x1: h.plane + deep, z0: h.a - 0.15, z1: h.b + 0.15 };
    const ox = overlap1d(bb.x0, bb.x1, zone.x0, zone.x1);
    const oz = overlap1d(bb.z0, bb.z1, zone.z0, zone.z1);
    if (ox > 0.04 && oz > 0.04)
      flag(it, h.kind === 'door' ? 'BLOCKS-DOOR' : 'BLOCKS-WINDOW',
        `${h.id} approach overlapped ${ox.toFixed(2)}m x ${oz.toFixed(2)}m`);
  }

  // wall penetration: AABB crossing an existing wall segment plane by > t/2 + 0.03
  for (let e = 0; e <= 14; e++) {
    for (const [orient, plane] of [['H', wz(e)], ['V', wx(e)]]) {
      const [lo, hi, flo, fhi] = orient === 'H' ? [bb.z0, bb.z1, bb.x0, bb.x1] : [bb.x0, bb.x1, bb.z0, bb.z1];
      if (lo >= plane || hi <= plane) continue;   // doesn't cross the plane
      for (let cell = Math.floor((flo - (orient === 'H' ? OX : OZ)) / CS); cell <= Math.floor((fhi - 0.01 - (orient === 'H' ? OX : OZ)) / CS); cell++) {
        const seg = orient === 'H' ? wallAt(it.lv, 'H', cell, e) : wallAt(it.lv, 'V', e, cell);
        if (!seg) continue;
        // crossing through a hole (a doorway/window) is handled above; only flag solid-wall crossings
        const inHole = holes.some((h) => h.orient === orient && h.lv === it.lv && Math.abs(h.plane - plane) < 0.01 &&
          overlap1d(flo, fhi, h.a, h.b) > 0 && h.kind === 'door');
        if (inHole) continue;
        const pen = Math.min(hi - plane, plane - lo);
        if (pen > seg.t / 2 + 0.05)
          flag(it, 'THRU-WALL', `crosses ${orient === 'H' ? 'z' : 'x'}=${plane} wall (cell ${cell}) by ${pen.toFixed(2)}m`);
        break;
      }
    }
  }

  // over a floor hole (stair shafts) or on the stairs
  for (const [lv, x0, z0, x1, z1] of (T.floorHoles || [])) {
    if (lv !== it.lv) continue;
    if (overlap1d(bb.x0, bb.x1, wx(x0), wx(x1 + 1)) > 0.05 && overlap1d(bb.z0, bb.z1, wz(z0), wz(z1 + 1)) > 0.05)
      flag(it, 'OVER-SHAFT', `overlaps floor hole [${x0},${z0}..${x1},${z1}]`);
  }
  for (const r of (T.ramps || [])) {
    const ry0 = Math.min(r.y0, r.y1), ry1 = Math.max(r.y0, r.y1);
    if (floor < ry0 - 0.2 || floor > ry1 + 0.2) continue;
    if (overlap1d(bb.x0, bb.x1, wx(r.x0), wx(r.x1 + 1)) > 0.05 && overlap1d(bb.z0, bb.z1, wz(r.z0), wz(r.z1 + 1)) > 0.05)
      flag(it, 'ON-STAIRS', `overlaps ramp [${r.x0},${r.z0}..${r.x1},${r.z1}]`);
  }
}

// ---- report ----
console.log(`audited ${items.filter((i) => !i.skip).length} placements, ${holes.length} holes\n`);
if (!flags.length) console.log('CLEAN — no placement conflicts found');
for (const f of flags)
  console.log(`FLAG ${f.code}  house.js:${f.line}  ${f.fn}\n     ${f.call}\n     ${f.detail}`);
process.exit(0);

// probe-cave-water.mjs -- the round-thirteen water pass, in numbers.
//
// PURE NODE. No browser, no playwright, no GPU. It re-derives the placement
// maths of buildPathSheen / buildLowSteam / buildCeilingDrips from the SAME
// authored tables the game reads (parsed straight out of src/underfalls.js, so
// they cannot drift) and the SAME seeded RNG (parsed straight out of
// src/util.js), then answers the four questions the plan left open that
// arithmetic can actually settle:
//
//   1. how many treads, puffs and drip sites there really are, and what they
//      cost in draw calls;
//   2. whether ANY steam puff is over the drawn path, or over a stretch of
//      floor that was never drawn -- the "not on the path" claim, checked
//      rather than asserted;
//   3. whether every drip site has rock above it, given that the route roof is
//      placed at the leg's AVERAGE elevation while a site takes the LOCAL one;
//   4. how much light the steam actually adds, and WHERE -- the screen area
//      the wet path occupies versus the shoulders either side of it. That is
//      the district's whole wayfinding read, and the plan's first open
//      question is that the steam must not flatten it.
//
// WHAT IT CANNOT DO: it cannot tell you what the frame looks like. Question 4
// is the steam's own contribution only; the ribbon's luminance under the
// district's lights is a renderer question and still needs a WebGL readback or
// Alex's eyes. Do not read a ratio out of this file that it did not print.
//
//   node tools/probe-cave-water.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const underfallsSrc = readFileSync(join(ROOT, 'src/underfalls.js'), 'utf8');
const utilSrc = readFileSync(join(ROOT, 'src/util.js'), 'utf8');

// ---- the real tables and the real RNG, lifted out of the real files --------
function grabFrozenTable(name) {
  const head = `const ${name} = Object.freeze([`;
  const i = underfallsSrc.indexOf(head);
  if (i < 0) throw new Error(`table ${name} not found -- did it get renamed?`);
  const j = underfallsSrc.indexOf('\n]);', i);
  const body = underfallsSrc.slice(i + head.length - 1, j + 2);
  return new Function('Object', `return ${body.replace(/\r/g, '')}`)({ freeze: (v) => v });
}
function grabFunction(src, name) {
  const i = src.indexOf(`export function ${name}(`);
  const j = src.indexOf('\n}', i);
  const body = src.slice(i, j + 2).replace('export ', '').replace(/\r/g, '');
  return new Function(`${body}; return ${name};`)();
}
const mulberry32 = grabFunction(utilSrc, 'mulberry32');
class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  float() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

const MAIN = grabFrozenTable('MAIN_LOCAL');
const SECRET = grabFrozenTable('SECRET_LOCAL');
const CHAMBERS = grabFrozenTable('CHAMBERS_LOCAL');

// ---- the layout, mirrored from createUnderfallsLayout ---------------------
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
const mainSegments = makeSegments(MAIN, 'main');
const secretSegments = makeSegments(SECRET, 'secret');
const segments = [...mainSegments, ...secretSegments];
const mainLength = mainSegments.reduce((s, g) => s + g.length, 0);

function segmentProjection(seg, x, z) {
  const t = clamp(((x - seg.a.x) * seg.dx + (z - seg.a.z) * seg.dz) / (seg.length2 || 1), 0, 1);
  const cx = seg.a.x + seg.dx * t, cz = seg.a.z + seg.dz * t;
  const d = Math.hypot(x - cx, z - cz);
  const w = lerp(seg.a.w, seg.b.w, t);
  return { t, cx, cz, d, w, y: lerp(seg.a.y, seg.b.y, t), clearance: d - w };
}
function projectMain(x, z) {
  let best = null;
  for (const seg of mainSegments) {
    const p = segmentProjection(seg, x, z);
    if (!best || p.clearance < best.clearance) best = p;
  }
  return best;
}
function projectUnion(x, z) {
  let best = null;
  for (const seg of segments) {
    const p = segmentProjection(seg, x, z);
    if (!best || p.clearance < best.clearance) best = p;
  }
  for (const c of CHAMBERS) {
    const d = Math.hypot(x - c.x, z - c.z);
    const p = { d, w: c.r, y: c.y, clearance: d - c.r };
    if (!best || p.clearance < best.clearance) best = p;
  }
  return best;
}

// ---- the constants the builders use ---------------------------------------
const ribbonHalfWidth = (w) => clamp(w * 0.46, 0.94, 1.72);
const STEAM_RIBBON_GAP = 0.20;
const STEAM_FLOOR_GAP = 0.15;
const WATER_WRAP = 600;
const DRIP_G = 9.81;
const ROUTE_ROOF_UNDER = 4.63;
const CHAMBER_VAULT_UNDER = 5.18 - 0.17;
const CHAPEL_VAULT_UNDER = 5.72 - 0.17;
// Read the dials out of the shader source itself, so this probe can never
// report a number the game is not actually using.
const steamBlock = underfallsSrc.slice(
  underfallsSrc.indexOf('function buildLowSteam'),
  underfallsSrc.indexOf('function buildCeilingDrips'));
const sheenBlock = underfallsSrc.slice(
  underfallsSrc.indexOf('function buildPathSheen'),
  underfallsSrc.indexOf('function buildLowSteam'));
function dial(block, name) {
  const m = block.match(new RegExp(name + ':\\s*\\{\\s*value:\\s*([0-9.]+)'));
  if (!m) throw new Error(name + ' not found in the shader');
  return Number(m[1]);
}
const STEAM_SIZE = dial(steamBlock, 'uSize');
const STEAM_OPACITY = dial(steamBlock, 'uOpacity');
const STEAM_SIZE_CAP = Number(steamBlock.match(/1\.0, ([0-9.]+)\);/)[1]);
const STEAM_TINT = [0x4d / 255, 0x61 / 255, 0x6a / 255];
const FOG = 0.055;

const say = (...a) => console.log(...a);
const f = (v, n = 2) => Number(v).toFixed(n);

// ---- 1. the sheen ---------------------------------------------------------
let sheen = 0, pitchMin = Infinity, pitchMax = 0;
for (const seg of mainSegments) {
  const n = Math.max(2, Math.ceil(seg.length / 0.9));
  sheen += n;
  pitchMin = Math.min(pitchMin, seg.length / n);
  pitchMax = Math.max(pitchMax, seg.length / n);
}
say('== wet path sheen ==');
say(`  main route            ${f(mainLength, 3)} m in ${mainSegments.length} legs`);
say(`  treads (instances)    ${sheen}   -> 1 draw call, ${sheen * 2} triangles`);
say(`  tread pitch           ${f(pitchMin, 4)} .. ${f(pitchMax, 4)} m`);
say(`  tread depth (x0.98)   ${f(pitchMin * 0.98, 4)} .. ${f(pitchMax * 0.98, 4)} m`);
say(`  gap between treads    ${f(pitchMin * 0.02 * 1000, 1)} .. ${f(pitchMax * 0.02 * 1000, 1)} mm`
  + '   (the ribbon under it OVERLAPS by 80 mm; an additive sheet doing that'
  + ' would draw a seam every tread)');

// ---- 2. the steam ---------------------------------------------------------
const rng = new RNG(0x57ea3fa1);
const puffs = [];
let authored = 0, rejectedOnPath = 0, rejectedOffFloor = 0;
let worstRibbonClear = Infinity, worstFloorDepth = Infinity;
const push = (x, y, z) => {
  const phase = rng.float();
  const span = rng.range(0.55, 1.25);
  const rate = Math.round(WATER_WRAP / rng.range(12, 26)) / WATER_WRAP;
  const sway = rng.range(0.45, 1.0);
  puffs.push({ x, y, z, phase, span, rate, sway });
};
const clearOfPath = (x, z) => {
  authored++;
  const onPath = projectMain(x, z);
  if (!onPath || onPath.d < ribbonHalfWidth(onPath.w) + STEAM_RIBBON_GAP) { rejectedOnPath++; return false; }
  const floor = projectUnion(x, z);
  if (!floor || floor.clearance > -STEAM_FLOOR_GAP) { rejectedOffFloor++; return false; }
  worstRibbonClear = Math.min(worstRibbonClear, onPath.d - ribbonHalfWidth(onPath.w));
  worstFloorDepth = Math.min(worstFloorDepth, -floor.clearance);
  return true;
};
let corridorStations = 0;
let spacingMin = Infinity, spacingMax = 0;
for (const seg of mainSegments) {
  const stations = Math.max(2, Math.round(seg.length / 2.2));
  corridorStations += stations;
  const spacing = seg.length / stations;
  spacingMin = Math.min(spacingMin, spacing);
  spacingMax = Math.max(spacingMax, spacing);
  const reach = Math.min(0.9, spacing * 0.5);
  const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
  const nx = tz, nz = -tx;
  for (let i = 0; i < stations; i++) {
    const t = (i + 0.5) / stations;
    const cx = seg.a.x + seg.dx * t, cz = seg.a.z + seg.dz * t;
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
const corridorPuffs = puffs.length;
const perChamber = [];
for (const chamber of CHAMBERS) {
  const before = puffs.length;
  const count = Math.round(chamber.r * chamber.r * 0.553);
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU);
    const rr = chamber.r * rng.range(0.63, 1.0);
    const x = chamber.x + Math.cos(a) * rr;
    const z = chamber.z + Math.sin(a) * rr;
    if (!clearOfPath(x, z)) continue;
    push(x, chamber.y + rng.range(0.02, 0.26), z);
  }
  perChamber.push(`${chamber.name} ${puffs.length - before}/${count}`);
}
say('');
say('== low steam ==');
say(`  corridor stations     ${corridorStations} at ${f(spacingMin, 2)}..${f(spacingMax, 2)} m`
  + `  (tangential jitter is capped at half a spacing, so no puff crosses into its neighbour)`);
say(`  candidates authored   ${authored}`);
say(`  rejected: on the path ${rejectedOnPath}    over unfloored void ${rejectedOffFloor}`);
say(`  puffs kept            ${puffs.length}   -> 1 draw call, 0 triangles`);
say(`     corridor ${corridorPuffs}, chambers ${puffs.length - corridorPuffs}  [${perChamber.join(', ')}]`);
say(`  NOT ON THE PATH: closest puff to the wet ribbon's edge  ${f(worstRibbonClear, 3)} m`
  + `  (floor is ${f(STEAM_RIBBON_GAP, 2)})`);
say(`  NOT OVER A VOID: shallowest puff inside the drawn floor ${f(worstFloorDepth, 3)} m`
  + `  (floor is ${f(STEAM_FLOOR_GAP, 2)})`);

// ---- 3. the drips ---------------------------------------------------------
const drng = new RNG(0x0d719b3d);
const lastSeg = mainSegments[mainSegments.length - 1];
const routeTotal = lastSeg.distance + lastSeg.length;
const sites = [];
let clampedByRoof = 0, minRoofClear = Infinity;
for (let i = 0; i < 29; i++) {
  const s = (i + 0.5) * (routeTotal / 29);
  let seg = lastSeg;
  for (const c of mainSegments) { if (s <= c.distance + c.length) { seg = c; break; } }
  const t = clamp((s - seg.distance) / (seg.length || 1), 0, 1);
  const nx = seg.dz / seg.length, nz = -seg.dx / seg.length;
  const w = lerp(seg.a.w, seg.b.w, t);
  const off = drng.range(-0.72, 0.72) * ribbonHalfWidth(w);
  const x = seg.a.x + seg.dx * t + nx * off;
  const z = seg.a.z + seg.dz * t + nz * off;
  const y = lerp(seg.a.y, seg.b.y, t);
  let ceiling = (seg.a.y + seg.b.y) * 0.5 + ROUTE_ROOF_UNDER;
  for (const c of CHAMBERS) {
    if (Math.hypot(x - c.x, z - c.z) > c.r * 0.96) continue;
    ceiling = Math.min(ceiling, c.y + (c.name === 'drowned pump chapel' ? CHAPEL_VAULT_UNDER : CHAMBER_VAULT_UNDER));
  }
  const wanted = drng.range(3.3, 4.4);
  const headroom = Math.min(wanted, ceiling - y - 0.15);
  const per = WATER_WRAP / Math.round(WATER_WRAP / drng.range(2.6, 6.2));
  const ph = drng.float();
  if (headroom < 1.2) continue;
  if (headroom < wanted - 1e-9) clampedByRoof++;
  minRoofClear = Math.min(minRoofClear, ceiling - (y + headroom));
  const fallT = Math.sqrt(2 * headroom / DRIP_G);
  sites.push({ x, z, y, headroom, per, ph, fallT, fallFrac: fallT / per, seg: seg.index });
}
const stat = (arr) => `${f(Math.min(...arr), 2)} .. ${f(Math.max(...arr), 2)}`;
say('');
say('== ceiling drips ==');
say(`  sites                 ${sites.length} of 29 attempted   -> 1 draw call, ${sites.length * 2} points`);
say(`  headroom              ${stat(sites.map((s) => s.headroom))} m   (${clampedByRoof} clamped by their own leg's roof)`);
say(`  ROCK OVERHEAD: smallest gap between a bead's start and the ceiling above it  ${f(minRoofClear, 3)} m`);
say(`  fall time             ${stat(sites.map((s) => s.fallT))} s   impact ${stat(sites.map((s) => DRIP_G * s.fallT))} m/s`);
say(`  period                ${stat(sites.map((s) => s.per))} s   (all exact divisors of ${WATER_WRAP}: `
  + `${sites.every((s) => Math.abs(WATER_WRAP / s.per - Math.round(WATER_WRAP / s.per)) < 1e-9) ? 'yes' : 'NO'})`);
say(`  duty cycle            ${stat(sites.map((s) => s.fallFrac * 100))} % of each period has a bead in the air`);
const meanDuty = sites.reduce((a, s) => a + s.fallFrac, 0) / sites.length;
say(`  expected beads in the air district-wide, at any instant: ${f(meanDuty * sites.length, 2)}`);
const dripsPerMin = sites.reduce((a, s) => a + 60 / s.per, 0);
say(`  landings per minute district-wide: ${f(dripsPerMin, 1)} -- of which only the ones`
  + ` near the player are voiced, and never two inside one cooldown. What that`
  + ` comes to while walking is measured further down.`);

// ---- 4. where the steam's light actually lands ----------------------------
// A camera pose, a screen grid, and the steam's own additive contribution
// summed per sample. Every term below is the vertex/fragment shader's, in JS:
// the same fract() rise, the same manual fog, the same 44/d point size with
// the same clamp, the same pow(1-r, 2.4) sprite falloff, the same 0.004 alpha
// cut that zeroes the point size. Nothing is estimated except the pose.
const W = 1920, H = 1080;
const FOV = 71, EYE = 1.62;
const tanHalf = Math.tan((FOV * Math.PI) / 360);
const aspect = W / H;
const PHASES = 12;

// Camera basis for a level look down the route: forward F, right R = (-fz,0,fx),
// up (0,1,0). No pitch and no roll, which is the pose the walking read lives in.
function poseAt(nodeIndex) {
  const a = MAIN[nodeIndex], b = MAIN[nodeIndex + 1];
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  return { name: a.name, x: a.x, y: a.y + EYE, floor: a.y, z: a.z, fx: dx / len, fz: dz / len };
}

// every visible sprite for one pose at one instant, in screen space
function spritesAt(pose, time) {
  const out = [];
  for (const p of puffs) {
    const u = (time * p.rate + p.phase) % 1;
    const life = smoothstep(0, 0.22, u) * (1 - smoothstep(0.52, 1, u));
    if (life <= 0) continue;
    const px = p.x + Math.sin(time * 0.115192 + p.phase * TAU) * 0.22 * p.sway;
    const py = p.y + u * p.span;
    const pz = p.z + Math.cos(time * 0.073304 + p.phase * TAU) * 0.18 * p.sway;
    const vx = px - pose.x, vy = py - pose.y, vz = pz - pose.z;
    const depth = vx * pose.fx + vz * pose.fz;
    if (depth < 0.3) continue;
    const fog = Math.exp(-(FOG * depth) * (FOG * depth));
    const alpha = life * fog;
    if (alpha < 0.004) continue;            // the shader zeroes the point size here
    const right = vx * -pose.fz + vz * pose.fx;
    const ndcX = right / (depth * tanHalf * aspect);
    const ndcY = vy / (depth * tanHalf);
    if (Math.abs(ndcX) > 1.6 || Math.abs(ndcY) > 1.6) continue;
    out.push({
      ndcX, ndcY, alpha,
      size: clamp(STEAM_SIZE * (44 / Math.max(1, depth)), 1, STEAM_SIZE_CAP),
    });
  }
  return out;
}

// which band of the floor does this pixel look at: the drawn path, or the
// shoulder either side of it? (Sampled against the pose's own floor plane --
// the route rises 3.2 m over its length, so a very long sightline down a
// climbing leg is approximate. It is the near half of the frame that carries
// the read.)
function bandAt(pose, ndcX, ndcY) {
  const rx = ndcX * tanHalf * aspect, ry = ndcY * tanHalf;
  const dir = { x: pose.fx - rx * pose.fz, y: ry, z: pose.fz + rx * pose.fx };
  if (dir.y >= -0.001) return 'sky';
  const tHit = EYE / -dir.y;
  if (tHit > 60) return 'far';
  const p = projectMain(pose.x + dir.x * tHit, pose.z + dir.z * tHit);
  if (!p) return 'off';
  if (p.d <= ribbonHalfWidth(p.w)) return 'path';
  if (p.d <= p.w) return 'shoulder';
  return 'off';
}

say('');
say('== what the steam adds, and where ==');
say(`  Additive output per pixel, summed over every puff, averaged over ${PHASES} phases`);
say('  of the 600 s clock. Tint 0x4d616a has relative luminance 0.366, so the');
say('  numbers below are added LUMA, in output units where 1.0 is white.');
say('');
say('  pose                    path       shoulder    peak      shoulder px');
for (const idx of [2, 4, 7, 10]) {
  const pose = poseAt(idx);
  const frames = [];
  for (let k = 0; k < PHASES; k++) frames.push(spritesAt(pose, k * (WATER_WRAP / PHASES)));
  let pathSum = 0, pathN = 0, shSum = 0, shN = 0, peak = 0;
  for (let sy = 0; sy < 30; sy++) {
    for (let sx = 0; sx < 54; sx++) {
      const ndcX = ((sx + 0.5) / 54) * 2 - 1;
      const ndcY = 1 - ((sy + 0.5) / 30) * 2;
      const band = bandAt(pose, ndcX, ndcY);
      if (band !== 'path' && band !== 'shoulder') continue;
      let acc = 0;
      for (const frame of frames) {
        for (const s of frame) {
          const rpx = Math.hypot((s.ndcX - ndcX) * 0.5 * W, (s.ndcY - ndcY) * 0.5 * H);
          const dcoord = (2 * rpx) / s.size;
          if (dcoord >= 1) continue;
          acc += Math.pow(1 - dcoord, 2.4) * STEAM_OPACITY * s.alpha;
        }
      }
      acc = (acc / frames.length) * 0.366;
      if (band === 'path') { pathSum += acc; pathN++; } else { shSum += acc; shN++; peak = Math.max(peak, acc); }
    }
  }
  say(`  ${pose.name.padEnd(20)}  ${f(pathN ? pathSum / pathN : 0, 4)}     ${f(shN ? shSum / shN : 0, 4)}      ${f(peak, 4)}    ${shN}`);
}
say('');
say('  Read it like this. The SHOULDER column is what the steam adds to the');
say('  dark either side of the wet path -- the thing he could not see before.');
say('  The PATH column is the leak onto the path itself: puffs standing');
say('  between the eye and a far stretch of ribbon. The path column being');
say('  well under the shoulder column is what "steam at the sides, not on the');
say('  path" means once it is on a screen instead of on a floor plan.');
say('');
say('  What this CANNOT settle: whether the wet ribbon still out-values the');
say('  shoulders it runs between. That needs the ribbon\'s own lit luminance,');
say('  which is a renderer answer -- a WebGL readback with the steam toggled,');
say('  or his eyes on a still from the chapel. uOpacity is the dial.');

// ---- 5. the sheen's own additive curve ------------------------------------
// Same terms as the fragment shader, evaluated straight down the corridor at
// eye height with the rivulets at their brightest, so this is the WORST case
// the sheet can produce at each distance -- not the average.
say('');
say('== wet path sheen, worst-case addition by distance ==');
const SHEEN_GAIN = 0.9, SHEEN_EXP = 3.4;
const SHEEN_LUMA = 0.2126 * 0.52 + 0.7152 * 0.62 + 0.0722 * 0.66;
say(`  colour (0.52,0.62,0.66) -> relative luminance ${f(SHEEN_LUMA, 3)}`);
say('   dist   fresnel   fog    near    alpha   added luma');
let best = { luma: 0 };
for (let d = 1; d <= 40; d += 0.25) {
  const vy = EYE / Math.hypot(d, EYE);
  const fres = Math.pow(clamp(1 - Math.abs(vy), 0, 1), SHEEN_EXP);
  const fog = Math.exp(-(FOG * d) * (FOG * d));
  const near = smoothstep(1.1, 4.5, d);
  const alpha = Math.min(0.62, fres * 1.0 * fog * near * SHEEN_GAIN);
  const luma = alpha * SHEEN_LUMA;
  if (luma > best.luma) best = { d, fres, fog, near, alpha, luma };
  if (Math.abs(d % 4) < 1e-9 || d === 1) {
    say(`  ${f(d, 1).padStart(5)}   ${f(fres, 3)}   ${f(fog, 3)}   ${f(near, 3)}   ${f(alpha, 3)}   ${f(luma, 3)}`);
  }
}
say(`  peak: ${f(best.luma, 3)} added luma at ${f(best.d, 2)} m`);
say(`  at your own feet (1.6 m): ${f(smoothstep(1.1, 4.5, 1.6) * Math.pow(1 - EYE / Math.hypot(1.6, EYE), SHEEN_EXP) * SHEEN_GAIN * SHEEN_LUMA, 4)}`);
say('  -- which is the whole design: nothing under your boots, gloss down the');
say('  corridor. If it reads as a lit runway rather than as wet stone, drop');
say('  uGain first and raise the exponent second.');

// ---- 6. the value ladder these three additive terms make -------------------
// All three effects are ADDITIVE, so each one's brightest possible pixel is a
// number, not an opinion. The path has to stay the brightest thing in the
// frame; that is the whole wayfinding read this district was built on.
say('');
say('== the ladder, worst case per effect (added luma over whatever is behind it) ==');
const steamLuma = 0.2126 * STEAM_TINT[0] + 0.7152 * STEAM_TINT[1] + 0.0722 * STEAM_TINT[2];
const steamPeak = STEAM_OPACITY * 1.0 * Math.exp(-(FOG * 3) * (FOG * 3)) * steamLuma;
const dripBlock = underfallsSrc.slice(underfallsSrc.indexOf('function buildCeilingDrips'));
const dripOpacity = Number(dripBlock.match(/uOpacity: \{ value: ([0-9.]+)/)[1]);
const dripLuma = 0.2126 * 0.62 + 0.7152 * 0.72 + 0.0722 * 0.76;
say(`  steam, sprite centre at 3 m   ${f(steamPeak, 3)}   (uOpacity ${f(STEAM_OPACITY, 3)}, tint luma ${f(steamLuma, 3)})`);
say(`  path sheen, peak at 10 m      ${f(best.luma, 3)}   (uGain ${f(SHEEN_GAIN, 2)}, colour luma ${f(SHEEN_LUMA, 3)})`);
say(`  a drip bead, dead centre      ${f(dripOpacity * dripLuma, 3)}   (uOpacity ${f(dripOpacity, 2)}) -- tiny, brief, ${f(meanDuty * sites.length, 1)} on screen at once`);
say('');
say('  So the sheen out-values the steam by about '
  + `${f(best.luma / steamPeak, 1)}x at its own peak, and the steam is nowhere`);
say('  near the path in a still frame. What is NOT settled here is the ribbon');
say('  surface underneath, which no arithmetic in this file can reach.');

// ---- 7. does any of it actually fire while you walk? -----------------------
// The two claims that are about the PLAYER rather than the geometry: that
// every drawn curtain wets the lens when you cross it, and that the drip
// ticks do not turn a quiet cave into a dripping tap. Both are settled by
// walking the route in a loop, with the exact test the ticker runs.
const CURTAIN_LEGS = [[0, 1], [1, 2], [8, 9], [9, 10], [11, 12]];
const curtains = CURTAIN_LEGS.map(([i, j]) => {
  const a = MAIN[i], b = MAIN[j];
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return {
    leg: `${a.name} -> ${b.name}`,
    x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
    tx: dx / len, tz: dz / len,
    half: (a.w + b.w) * 0.5 + 0.3, depth: 0.9,
  };
});
{
  const a = SECRET[0], b = SECRET[1];
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
  curtains.push({
    leg: `${a.name} -> ${b.name} (culvert)`,
    x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
    tx: dx / len, tz: dz / len,
    half: (a.w + b.w) * 0.5 + 0.3, depth: 0.9,
  });
}
function pointAt(dist) {
  let seg = mainSegments[mainSegments.length - 1];
  for (const c of mainSegments) { if (dist <= c.distance + c.length) { seg = c; break; } }
  const t = clamp((dist - seg.distance) / (seg.length || 1), 0, 1);
  return { x: seg.a.x + seg.dx * t, z: seg.a.z + seg.dz * t };
}
say('');
say('== walking the main route, at the ticker\'s own arithmetic ==');
const SPEED = 1.4, DT = 1 / 120;
const wet = curtains.map(() => ({ enter: null, exit: null, hits: 0 }));
const dripState = sites.map(() => -1);
let cooldown = 0, voiced = 0, lastVoiceAt = null;
// the two chatter dials, read out of the ticker so they cannot drift
const grabNum = (marker) => {
  const i = underfallsSrc.indexOf(marker);
  if (i < 0) throw new Error(marker + ' not found in the ticker');
  return parseFloat(underfallsSrc.slice(i + marker.length));
};
const DRIP_R2 = grabNum('ddz * ddz > ');
const DRIP_COOLDOWN = grabNum('DRIPS.cooldown = ');
const gaps = [];
for (let step = 0; step * DT * SPEED <= routeTotal; step++) {
  const time = step * DT;
  const p = pointAt(time * SPEED);
  for (let i = 0; i < curtains.length; i++) {
    const c = curtains[i];
    const dx = p.x - c.x, dz = p.z - c.z;
    const inside = Math.abs(dx * c.tx + dz * c.tz) <= c.depth
      && Math.abs(dx * c.tz - dz * c.tx) <= c.half;
    if (!inside) continue;
    wet[i].hits++;
    if (wet[i].enter === null) wet[i].enter = time * SPEED;
    wet[i].exit = time * SPEED;
  }
  cooldown -= DT;
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const cycle = Math.floor(time / s.per + s.ph - s.fallFrac);
    if (cycle === dripState[i]) continue;
    const stepped = dripState[i] >= 0 && cycle === dripState[i] + 1;
    dripState[i] = cycle;
    if (!stepped || cooldown > 0) continue;
    const dx = p.x - s.x, dz = p.z - s.z;
    if (dx * dx + dz * dz > DRIP_R2) continue;
    cooldown = DRIP_COOLDOWN;
    voiced++;
    if (lastVoiceAt !== null) gaps.push(time - lastVoiceAt);
    lastVoiceAt = time;
  }
}
const walkSeconds = routeTotal / SPEED;
say(`  one straight walk of the route: ${f(routeTotal, 1)} m at ${f(SPEED, 1)} m/s = ${f(walkSeconds, 1)} s`);
say('');
say('  CURTAINS -- every drawn sheet must wet the lens:');
for (let i = 0; i < curtains.length; i++) {
  const w = wet[i];
  say(`   ${w.hits ? 'crossed' : 'MISSED '}  ${curtains[i].leg.padEnd(34)}`
    + (w.hits ? `  ${f(w.exit - w.enter, 2)} m of route inside it (${f((w.exit - w.enter) / SPEED, 2)} s)` : '  -- not on the main route'));
}
say('');
say(`  DRIPS -- ${voiced} voiced in ${f(walkSeconds, 0)} s = one every ${f(walkSeconds / Math.max(1, voiced), 2)} s`);
if (gaps.length) {
  gaps.sort((a, b) => a - b);
  say(`   gaps between voiced drips: min ${f(gaps[0], 2)} s, median ${f(gaps[Math.floor(gaps.length / 2)], 2)} s,`
    + ` max ${f(gaps[gaps.length - 1], 2)} s`);
}
say(`   for scale, director.js's blind cave ecology already fires one every 2.7-4.8 s.`);
say(`   dials in force: radius ${f(Math.sqrt(DRIP_R2), 1)} m, cooldown ${f(DRIP_COOLDOWN, 2)} s.`);

// ---- 8. how wet does a crossing actually make the lens? -------------------
// The grain shader lights a cell when hash(cell) < uWet * 0.72, so uWet is
// literally the fraction of the screen grid holding a bead. These are the
// numbers behind "standing under a fall saturates it, a walk-through beads it".
const mainSrc = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const curtainBurst = grabNum('if (!was) game.splashLens?.(');
// the curtain top-up, not the spray zone's -- search forward from the burst
const curtainIdx = underfallsSrc.indexOf('if (!was) game.splashLens?.(');
const curtainRate = parseFloat(underfallsSrc.slice(
  underfallsSrc.indexOf('game.splashLens?.(dt * ', curtainIdx) + 23));
const dryCave = Number(mainSrc.slice(mainSrc.indexOf("'cave' ? ") + 9).match(/^[0-9.]+/)[0]);
const crossSeconds = (2 * curtains[0].depth) / SPEED;
const crossWet = Math.min(1, curtainBurst + crossSeconds * curtainRate);
say('');
say('== the lens ==');
say(`  a curtain crossing at ${f(SPEED, 1)} m/s: burst ${f(curtainBurst, 2)} + ${f(crossSeconds, 2)} s`
  + ` at ${f(curtainRate, 2)}/s  ->  uWet ${f(crossWet, 2)}, i.e. ${f(crossWet * 0.72 * 100, 0)}% of the`
  + ` bead grid lit`);
say(`  a spray zone: 0.55 on the edge, 0.60/s inside  ->  uWet 1.00 after ${f(0.45 / 0.6, 2)} s standing in it`);
say(`  dry-off: ${f(1 / dryCave, 1)} s from saturated to dry inside the cave, 0.45 s anywhere else`);
say('  -- a walk-through beads the glass, a fall soaks it. That is the whole');
say('  dynamic range the effect has, and it is why the two are dialled apart.');

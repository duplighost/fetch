// probe-bell-cistern.mjs -- the fallen bell owns its own silhouette, and the
// chain still points at it. Pure node, no browser, safe in any batch.
//
//   node tools/probe-bell-cistern.mjs
//
// Round twelve dropped the bell 1.18 m onto the floor of the bell cistern,
// which is a chamber AND a node on the secret route -- and left it without a
// collider, so 2.06 m of iron stood on the walking line and the player went
// through it. That is exactly the complaint Alex made about this district.
// This replays the builder's own arithmetic from the source text so the three
// things that make the fix true stay true:
//
//   1. the collider is an AABB, so its CORNERS are what stick out: r * sqrt(2)
//      has to stay inside the rim ring or the player is stopped by nothing;
//   2. it has to be tall enough that player.js does not classify it as a
//      walkable step (max.y <= feet + STEP_UP) and short enough not to be
//      overhead (min.y >= feet + HEAD);
//   3. the lane has to survive: the chamber is 3.45 m of floor and the route
//      passes through its centre, so the annulus left around the collider is
//      the thing to watch, not the collider's size.
//
// Plus the snapped chain: its free end has to hang over the bell's mouth
// rather than a metre and a half from anything.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const underfalls = readFileSync(join(root, 'src', 'underfalls.js'), 'utf8');
const player = readFileSync(join(root, 'src', 'player.js'), 'utf8');

const failures = [];
const check = (ok, line) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${line}`); if (!ok) failures.push(line); };
const grab = (src, re, what) => {
  const m = src.match(re);
  if (!m) { console.error(`could not read ${what} -- the source moved, fix this probe`); process.exit(2); }
  return m;
};
const f = (x, n = 3) => Number(x).toFixed(n);

// ---- what the source says ------------------------------------------------
const profileText = grab(underfalls, /const bellProfile = \[([\s\S]*?)\]\.map/, 'bellProfile')[1];
const profile = [...profileText.matchAll(/\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g)]
  .map((m) => [Number(m[1]), Number(m[2])]);
const rimY = Number(grab(underfalls, /bellRim\.position\.set\(C\.x, C\.y \+ ([\d.]+), C\.z\)/, 'rim height')[1]);
const rimTorus = grab(underfalls, /bellRim = new THREE\.Mesh\(new THREE\.TorusGeometry\(([\d.]+), ([\d.]+),/, 'rim torus');
const rimR = Number(rimTorus[1]);
const rimTube = Number(rimTorus[2]);

const col = grab(underfalls,
  /addColliderCylinder\(world, C\.x, C\.z, ([\d.]+), C\.y - ([\d.]+), C\.y \+ ([\d.]+), 'fallen bell'\)/,
  "the bell's collider");
const colR = Number(col[1]), colBelow = Number(col[2]), colAbove = Number(col[3]);

const chain = grab(underfalls,
  /const snapped = new THREE\.Mesh\(new THREE\.CylinderGeometry\([\d.]+, [\d.]+, ([\d.]+), \d+\), iron\);[\s\S]{0,120}?snapped\.position\.set\(C\.x \+ ([\d.]+), C\.y \+ ([\d.]+), C\.z - ([\d.]+)\);[\s\S]{0,80}?snapped\.rotation\.z = ([\d.]+);/,
  'the snapped chain');
const chainLen = Number(chain[1]), chainX = Number(chain[2]), chainY = Number(chain[3]);
const chainZ = Number(chain[4]), chainTilt = Number(chain[5]);

const chamberR = Number(grab(underfalls, /r: ([\d.]+), name: 'bell cistern'/, 'the bell chamber radius')[1]);
const routeW = Number(grab(underfalls, /w: ([\d.]+), name: 'bell cistern'/, 'the secret route width at the bell')[1]);
const clampMargin = Number(grab(underfalls, /const safeW = Math\.max\(0\.35, p\.w - ([\d.]+)\)/, "the clamp's safe margin")[1]);
const clampEarly = Number(grab(underfalls, /p\.clearance <= -([\d.]+)\) return;/, "the clamp's early-out")[1]);
const bodyR = Number(grab(player, /const RADIUS = ([\d.]+);/, "the player's radius")[1]);
const stepUp = Number(grab(player, /const STEP_UP = ([\d.]+);/, 'STEP_UP')[1]);
const head = Number(grab(player, /const HEAD = ([\d.]+);/, 'HEAD')[1]);

// ---- the arithmetic ------------------------------------------------------
const bellTop = profile[profile.length - 1][1];
const bellMaxR = Math.max(...profile.map((p) => p[0]));
const cornerOut = colR * Math.SQRT2;
const rimOuter = rimR + rimTube;

// the chain: local +y maps to (-sin, +cos) under a z rotation, so the FREE
// (low) end is the local -y cap
const half = chainLen / 2;
const lowX = chainX + half * Math.sin(chainTilt);
const lowY = chainY - half * Math.cos(chainTilt);
const lowRadial = Math.hypot(lowX, chainZ);

// the bell's own surface directly beneath that end
const surfaceAt = (radius) => {
  if (radius >= bellMaxR) return bellTop;
  for (let i = 1; i < profile.length; i++) {
    if (radius <= profile[i][0]) {
      const t = (radius - profile[i - 1][0]) / (profile[i][0] - profile[i - 1][0]);
      return profile[i - 1][1] + t * (profile[i][1] - profile[i - 1][1]);
    }
  }
  return bellTop;
};
const dropBelowChain = lowY - surfaceAt(Math.min(lowRadial, bellMaxR));

// the lane. projectUnderfalls takes the SMALLEST clearance, and the chamber is
// wider than the route node here, so the chamber is what the clamp sees.
const laneW = Math.max(chamberR, routeW);
const centreMin = colR + bodyR;                 // pushed out on an axis
const centreMax = laneW - clampEarly;           // the clamp early-outs inside this

console.log('bell cistern, from source:');
console.log(`  bell        base at C.y, top ${f(bellTop, 2)}, widest ${f(bellMaxR, 2)} (${f(bellMaxR * 2, 2)} m across)`);
console.log(`  rim         ring r ${f(rimR, 2)} tube ${f(rimTube, 3)} at C.y+${f(rimY, 2)}  (outer edge ${f(rimOuter)})`);
console.log(`  collider    r ${f(colR, 2)}, C.y-${f(colBelow, 2)} .. C.y+${f(colAbove, 2)}, corners ${f(cornerOut)} from the axis`);
console.log(`  chain       len ${f(chainLen, 2)} at +${f(chainX, 2)}/+${f(chainY, 2)} tilt ${f(chainTilt, 2)}`);
console.log(`              free end ${f(lowRadial)} out, C.y+${f(lowY)}, ${f(lowY - rimY)} over the rim plane`);
console.log(`  lane        chamber ${f(chamberR, 2)}, route node ${f(routeW, 2)}, player r ${f(bodyR, 2)}`);
console.log(`  clamp       early-outs at clearance -${f(clampEarly, 2)}, pulls back to w-${f(clampMargin, 2)}`);
console.log('');

check(cornerOut <= rimR,
  `the collider's corners (${f(cornerOut)}) stay inside the rim ring (${f(rimR, 2)}) -- no invisible wall proud of the iron`);
check(colR <= bellMaxR,
  `the collider (${f(colR, 2)}) is no wider than the bell (${f(bellMaxR, 2)})`);
check(colAbove >= rimY,
  `the collider (C.y+${f(colAbove, 2)}) reaches the rim (C.y+${f(rimY, 2)}) -- the widest part is the part you would walk into`);
check(colAbove > stepUp,
  `the collider is taller than STEP_UP (${f(colAbove, 2)} > ${f(stepUp, 2)}) -- player.js would otherwise treat it as a walkable step`);
check(-colBelow < head,
  `the collider's floor sits at feet${f(-colBelow, 2)}, under feet+HEAD (${f(head, 2)}) -- it is not classified as overhead`);
check(centreMax - centreMin >= 2,
  `the walkable annulus around it is ${f(centreMin)}..${f(centreMax)} = ${f(centreMax - centreMin)} m wide`);
check(lowRadial < rimR,
  `the chain's free end (${f(lowRadial)}) hangs inside the rim (${f(rimR, 2)}) -- over the mouth, not beside it`);
check(lowY > rimY,
  `the chain's free end (C.y+${f(lowY)}) is still ABOVE the rim (C.y+${f(rimY, 2)}) -- it broke, it did not land in the bell`);
check(dropBelowChain <= 0.9,
  `the gap from the chain's end to the iron under it is ${f(dropBelowChain)} m (was 1.309 with the bell dropped and the chain left alone)`);

console.log('');
console.log(`  note  the bell is a cone: the collider face stands ${f(colR - profile[0][0])} m outside the iron at the base`);
console.log(`        and ${f(rimOuter - colR)} m inside the rim's outer edge at the top. The read is at chest height.`);
console.log('');
if (failures.length) {
  console.log(`${failures.length} FAILED`);
  process.exit(1);
}
console.log('all clear');

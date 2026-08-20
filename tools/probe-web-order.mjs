// probe-web-order.mjs -- the corner webs are checked against a FINISHED house.
// Pure node, no browser, safe in any batch.
//
//   node tools/probe-web-order.mjs
//
// Round twelve added fourteen web sites and a collider check to reject any
// that grew through the furniture, and reported "all nineteen cleared". The
// check ran inside furnish(), which is the FIRST of thirteen builders, so for
// every room built by one of the other twelve -- the boiler, the blind
// archive, the pump gallery, the hatchbay -- it was checking an empty room and
// the clearance it reported was worth nothing.
//
// The placement is deferred now, and this is the thing that can silently
// regress: not the geometry, the ORDER. If someone moves the drain up, or adds
// a fourteenth builder after it, the check quietly goes back to being
// decorative and nothing on screen changes. So this reads the source and
// asserts the shape of it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src', 'house.js'), 'utf8');

const failures = [];
const check = (ok, line) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${line}`); if (!ok) failures.push(line); };

const bodyOf = (header) => {
  const start = src.indexOf(header);
  if (start < 0) { console.error(`could not find ${header} -- the source moved, fix this probe`); process.exit(2); }
  // top-level functions in this file close on a brace in column 0
  const end = src.indexOf(`\n}`, start);
  return src.slice(start, end < 0 ? src.length : end);
};

const buildHouse = bodyOf('export function buildHouse(game)');
const furnish = bodyOf('function furnish(game)');

// every builder call buildHouse makes, in order
const builders = [...buildHouse.matchAll(/^ {2}(\w+)\(game\);/gm)].map((m) => ({ name: m[1], at: m.index }));
const drainAt = buildHouse.indexOf('for (const fn of game.__deferredBuild || []) fn();');
const last = builders[builders.length - 1];

console.log(`buildHouse calls ${builders.length} builders: ${builders.map((b) => b.name).join(', ')}`);
console.log('');

check(drainAt >= 0, 'buildHouse drains game.__deferredBuild');
check(drainAt >= 0 && last && drainAt > last.at,
  `the drain is after the LAST builder (${last ? last.name : '?'}), not after the first`);
check(buildHouse.includes('game.__deferredBuild = null;'),
  'the queue is emptied after draining, so a second buildHouse cannot run it twice');
check(furnish.includes('const placeWebs = () => {') && furnish.includes('.push(placeWebs)'),
  'furnish queues the web placement instead of running it inline');

// the check itself has to be INSIDE the deferred closure, not left behind
const closureAt = furnish.indexOf('const placeWebs = () => {');
const clearAt = furnish.indexOf('!webClear(x, y, z,');
check(closureAt >= 0 && clearAt > closureAt,
  'the webClear() test is inside the deferred closure');

// and the drain still has to be inside buildHouse: main.js slices
// houseRenderRoots and computes houseInteriorRoots after buildHouse returns,
// and a web added later would never enter the interior cull ledger
const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
const buildAt = main.indexOf('buildHouse(this);');
const rootsAt = main.indexOf('this.houseInteriorRoots = this._findHouseInteriorRoots();');
check(buildAt >= 0 && rootsAt > buildAt,
  'main.js takes its houseInteriorRoots census AFTER buildHouse returns, so the drained webs are in it');

console.log('');
if (failures.length) {
  console.log(`${failures.length} FAILED`);
  process.exit(1);
}
console.log('all clear');

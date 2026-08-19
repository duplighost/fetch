// probe-first-draw-cost.mjs -- WHICH objects cost the eight seconds?
//
// probe-first-draw proved the shape: draw every mesh once behind the title and
// the per-act stalls collapse (basement 9017ms -> 51ms). But it drew in chunks
// of 40 and reported only that 8 chunks of 55 went over 40 ms. Eight seconds
// hiding inside eight chunks is not "191 geometry uploads in one gulp" -- it is
// a short list of specific materials whose D3D specialization is expensive, and
// a short list is something you can warm cheaply and deliberately.
//
// So: same pass, one object at a time, and record every draw that costs
// anything, with enough about the material to recognise it in the source.
//
// The light guard is the same as probe-first-draw's, plus the lesson that cost
// this project a round: World.pinLight INTERCEPTS `.visible`, so a light it owns
// cannot be hidden by assignment. Those are counted and skipped instead -- a
// revealed light moves the census and recompiles the whole game, which shows up
// here as a program count that runs away.
//
// READ THE "+1 prog" COLUMN WITH SUSPICION -- IT IS PARTLY THIS TOOL'S OWN FAULT.
// It renders with the LIVE camera at its RESTING mask (world + held), and the
// game never renders that way: render() drops the camera to layer 0 for the
// world pass and to LAYER_HELD for the held pass. So a handful of the programs
// this pass "discovers missing" are variants the game does not use, and the
// enormous first render after them is the driver linking the tool's own work.
// tools/probe-warm-draw.mjs does the same pass through a dedicated layer-0
// camera and creates ZERO new programs, which is the honest number: the warm
// pass's compile coverage was never the problem. What is real here, and what
// this tool is still good for, is the RANKING -- which objects cost seconds the
// first time they are drawn, and what their materials have in common.
//
//   node tools/probe-first-draw-cost.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1&hitch=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
await page.waitForFunction(() => ['ready', 'degraded'].includes(window.__game.shaderWarmup.status), null, { timeout: 90000, polling: 100 });

const report = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

  const meshes = [];
  g.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) meshes.push(o); });

  const describe = (o) => {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const m = mats[0];
    const attrs = Object.keys(o.geometry?.attributes || {}).sort().join('+');
    const path = [];
    for (let p = o; p && p !== g.scene; p = p.parent) path.unshift(p.name || `(${p.type})`);
    const e = o.matrixWorld.elements;
    const wp = { x: e[12], y: e[13], z: e[14] };
    return {
      name: o.name || '(anon)',
      path: path.join('/'),
      at: [wp.x, wp.y, wp.z].map((n) => +n.toFixed(1)).join(','),
      zone: g.world.zoneAt?.(wp) || '',
      shadow: `${o.castShadow ? 'cast' : ''}${o.receiveShadow ? '+recv' : ''}` || 'none',
      parent: o.parent?.name || '',
      type: o.type,
      mat: m ? `${m.type}${m.name ? ':' + m.name : ''}` : 'none',
      maps: m ? ['map', 'normalMap', 'bumpMap', 'alphaMap', 'emissiveMap', 'aoMap', 'roughnessMap']
        .filter((k) => m[k]).join(',') : '',
      flags: m ? [
        m.transparent && 'transparent', m.vertexColors && 'vertexColors',
        m.side === 2 && 'double', m.alphaTest > 0 && 'alphaTest',
        o.isSkinnedMesh && 'skinned', o.isInstancedMesh && `instanced(${o.count})`,
        m.onBeforeCompile && 'onBeforeCompile',
      ].filter(Boolean).join(',') : '',
      attrs,
      tris: o.geometry?.index ? o.geometry.index.count / 3 : (o.geometry?.attributes?.position?.count || 0) / 3,
    };
  };

  // Does a SECOND compile() cover them? The warm pass already ran (this probe
  // waits for it), and compile() ignores visibility -- so if compiling the same
  // scene again still creates programs, those materials were not reachable when
  // the warm pass ran, and the fix is a matter of WHEN, not HOW.
  const recompile = { before: g.renderer.info.programs.length };
  const rc0 = performance.now();
  g.renderer.compile(g.scene, g.camera);
  recompile.ms = +(performance.now() - rc0).toFixed(0);
  recompile.after = g.renderer.info.programs.length;

  const draws = [];
  let pinnedLights = 0;
  const t0 = performance.now();
  const programsAt = [];
  for (let i = 0; i < meshes.length; i++) {
    const object = meshes[i];
    const restore = [];
    const reveal = (o) => { restore.push([o, o.visible]); o.visible = true; };
    reveal(object);
    const wasCulled = object.frustumCulled;
    object.frustumCulled = false;
    const wasCount = object.isInstancedMesh ? object.count : null;
    if (object.isInstancedMesh && object.count === 0) object.count = 1;
    const matVis = [];
    for (const m of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (m && m.visible === false) { matVis.push([m, m.visible]); m.visible = true; }
    }
    for (let p = object.parent; p && p !== g.scene; p = p.parent) if (!p.visible) reveal(p);
    object.traverse((child) => {
      if (child.isLight && child.visible) {
        restore.push([child, child.visible]);
        child.visible = false;
        if (child.visible === true) pinnedLights++;   // World.pinLight refused it
      }
    });

    const programsBefore = g.renderer.info.programs.length;
    const keysBefore = new Set(g.renderer.info.programs.map((p) => p.cacheKey));
    const c0 = performance.now();
    g.renderer.render(g.scene, g.camera);
    const ms = performance.now() - c0;
    // WHAT program appeared matters more than THAT one did: three's compile()
    // never touches the SHADOW pass, so a depth/distanceRGBA program here means
    // the warm pass could not have covered it by construction.
    const newPrograms = g.renderer.info.programs
      .filter((p) => !keysBefore.has(p.cacheKey))
      .map((p) => ({ name: p.name, key: String(p.cacheKey).slice(0, 140) }));

    for (let k = restore.length - 1; k >= 0; k--) restore[k][0].visible = restore[k][1];
    object.frustumCulled = wasCulled;
    if (wasCount !== null) object.count = wasCount;
    for (const [material, was] of matVis) material.visible = was;

    draws.push({ i, ms: +ms.toFixed(1), dProg: g.renderer.info.programs.length - programsBefore, newPrograms, ...describe(object) });
    if (i % 200 === 0) programsAt.push([i, g.renderer.info.programs.length]);
    if (i % 8 === 7) await frame();
  }
  const passMs = performance.now() - t0;

  return {
    recompile,
    meshes: meshes.length,
    passMs: +passMs.toFixed(0),
    pinnedLights,
    programsAt,
    programsEnd: g.renderer.info.programs.length,
    draws,
  };
});

await browser.close();
server.stop();

const draws = report.draws;
const total = draws.reduce((n, d) => n + d.ms, 0);
const baseline = draws.map((d) => d.ms).sort((a, b) => a - b)[Math.floor(draws.length / 2)];
const excess = draws.map((d) => ({ ...d, over: d.ms - baseline })).filter((d) => d.over > 10);
excess.sort((a, b) => b.over - a.over);

console.log(`${report.meshes} meshes drawn one at a time in ${report.passMs}ms (sum of renders ${total.toFixed(0)}ms)`);
console.log(`median render ${baseline.toFixed(1)}ms  =>  ${excess.length} draws carry excess, ${excess.reduce((n, d) => n + d.over, 0).toFixed(0)}ms of it`);
console.log(`second compile() at probe time: ${report.recompile.before} -> ${report.recompile.after} programs in ${report.recompile.ms}ms`);
console.log(`programs ${report.programsAt.map((p) => p.join(':')).join(' ')} -> ${report.programsEnd}`);
if (report.pinnedLights) console.log(`WARNING: ${report.pinnedLights} lights refused to hide (pinLight) — census may have moved`);

console.log('\nworst 24 first draws (excess over median):');
for (const d of excess.slice(0, 24)) {
  console.log(`  ${String(d.ms.toFixed(0)).padStart(5)}ms +${d.dProg}prog  ${d.mat} [${d.flags}] {${d.maps}} shadow=${d.shadow}`);
  console.log(`          ${d.path.slice(-110)}  @${d.at} ${d.zone}`);
  for (const p of d.newPrograms || []) console.log(`          NEW name=${p.name} key=${p.key}`);
}

// Group the excess by material signature: the fix warms MATERIALS, not objects.
const byMat = new Map();
for (const d of excess) {
  const key = `${d.mat} [${d.flags}] {${d.maps}}`;
  const e = byMat.get(key) || { key, ms: 0, n: 0 };
  e.ms += d.over; e.n++;
  byMat.set(key, e);
}
console.log('\nexcess grouped by material signature:');
for (const e of [...byMat.values()].sort((a, b) => b.ms - a.ms).slice(0, 20)) {
  console.log(`  ${String(e.ms.toFixed(0)).padStart(6)}ms  x${String(e.n).padStart(3)}  ${e.key.slice(0, 96)}`);
}

if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));
writeFileSync(resultsPath('first-draw-cost.json'), JSON.stringify(report, null, 2));
console.log(`\nfull record: ${resultsPath('first-draw-cost.json')}`);

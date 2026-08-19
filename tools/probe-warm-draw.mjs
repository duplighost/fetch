// probe-warm-draw.mjs -- the fix for the loading hitch, tried from the page
// before a line of it goes into the game.
//
// WHAT THE MEASUREMENTS SAY (probe-hitch, probe-link-wait, probe-first-draw-cost):
//   * the 7-9 second frame carries +191 geometries and +0 programs, and the
//     SAME run uploads 162 geometries entering the forest in 48 ms, so it is
//     not the geometry;
//   * a second renderer.compile() at title time creates 22 programs the warm
//     pass never made, in 131 ms;
//   * the first render after that compile costs 5024 ms, and every render after
//     it is cheap: the money is the driver LINKING those programs, charged to
//     whichever frame first draws with them;
//   * drawing every mesh once by hand collapses every act entry to 29-117 ms.
//
// So the missing half of round five's warm pass is the DRAW. compile() links a
// program; ANGLE/D3D11 does the rest of its work when that program is first used
// with a real input layout, and the game only ever does that in a district's
// first frame -- 40 of them at once, which is the freeze.
//
// THE PASS THIS PROBES (and what main.js should end up doing):
//   * one draw per (material x geometry layout x object kind) -- that tuple is
//     what decides a program and its vertex layout, so 2184 meshes collapse to
//     a few hundred draws;
//   * a dedicated camera pointed at empty sky, so the scene culls itself and
//     only the objects we deliberately un-cull are drawn;
//   * a 1x1 scissor on the DEFAULT framebuffer -- not a render target, because
//     a target's colour space is part of the program key and would warm the
//     wrong variant (that is why the mirror pass needs its own programs);
//   * nothing's `visible` is touched, ever. Revealing an object reveals the
//     lights under it, the census moves, and the whole game recompiles. Objects
//     that are hidden or culled get a PROXY that shares their geometry and
//     material and carries no lights.
//
//   node tools/probe-warm-draw.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1&hitch=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
await page.waitForFunction(() => ['ready', 'degraded'].includes(window.__game.shaderWarmup.status), null, { timeout: 90000, polling: 100 });

const report = await page.evaluate(async () => {
  const g = window.__game;
  // The page's import map resolves 'three' to the same module instance the game
  // holds, so this is the game's THREE, not a second copy with its own classes.
  const THREE = await import('three');
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- collect
  const seen = new Set();
  const work = [];
  g.scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      const layout = Object.keys(o.geometry?.attributes || {}).sort().join(',');
      const kind = `${o.isInstancedMesh ? 'i' : ''}${o.isSkinnedMesh ? 's' : ''}${o.isPoints ? 'p' : ''}${o.isLine ? 'l' : ''}${o.isSprite ? 'S' : ''}${o.geometry?.index ? 'x' : ''}`;
      const key = `${m.uuid}|${layout}|${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      work.push(o);
    }
  });

  // is this object drawable RIGHT NOW through a layer-0 camera?
  const drawable = (o) => {
    if (!(o.layers.mask & 1)) return false;
    if (o.isInstancedMesh && o.count === 0) return false;
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    return mats.every((m) => !m || m.visible !== false);
  };

  // ------------------------------------------------------------------ stage
  const warmRoot = new THREE.Group();
  warmRoot.name = 'warm-draw staging';
  warmRoot.visible = false;
  warmRoot.frustumCulled = false;
  g.scene.add(warmRoot);

  const proxyFor = (o) => {
    let p;
    if (o.isInstancedMesh) {
      p = new THREE.InstancedMesh(o.geometry, o.material, Math.max(1, o.count || 1));
      p.instanceMatrix = o.instanceMatrix;
      if (o.instanceColor) p.instanceColor = o.instanceColor;
      p.count = Math.max(1, o.count || 1);
    } else if (o.isPoints) p = new THREE.Points(o.geometry, o.material);
    else if (o.isLineSegments) p = new THREE.LineSegments(o.geometry, o.material);
    else if (o.isLine) p = new THREE.Line(o.geometry, o.material);
    else if (o.isSprite) p = new THREE.Sprite(o.material);
    else if (o.isSkinnedMesh) return null;          // needs its skeleton; always on screen anyway
    else p = new THREE.Mesh(o.geometry, o.material);
    p.frustumCulled = false;
    p.layers.mask = 1;
    p.matrixAutoUpdate = false;
    p.matrixWorld.copy(o.matrixWorld);
    return p;
  };

  const camera = new THREE.PerspectiveCamera(1, 1, 0.1, 2);
  camera.position.set(0, 4000, 0);                  // nothing lives up here
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 5000, 0);
  camera.layers.set(0);                             // the world pass's mask
  camera.updateMatrixWorld(true);

  // ------------------------------------------------------------------- pass
  const size = new THREE.Vector2();
  g.renderer.getSize(size);
  const programsBefore = g.renderer.info.programs.length;
  const budgets = [];
  const draws = [];
  const BUDGET_MS = 8;
  let proxies = 0;
  let index = 0;
  const t0 = performance.now();
  while (index < work.length) {
    const f0 = performance.now();
    g.renderer.setScissorTest(true);
    g.renderer.setScissor(0, 0, 1, 1);
    g.renderer.setViewport(0, 0, 1, 1);
    let spent = 0;
    while (index < work.length && spent < BUDGET_MS) {
      const o = work[index++];
      const live = drawable(o);
      let staged = null;
      let wasCulled = false;
      if (live) { wasCulled = o.frustumCulled; o.frustumCulled = false; }
      else {
        staged = proxyFor(o);
        if (!staged) continue;
        warmRoot.add(staged);
        proxies++;
      }
      warmRoot.visible = true;
      const d0 = performance.now();
      g.renderer.render(g.scene, camera);
      const ms = performance.now() - d0;
      warmRoot.visible = false;
      if (live) o.frustumCulled = wasCulled;
      else { warmRoot.remove(staged); }
      spent += ms;
      draws.push(+ms.toFixed(1));
    }
    g.renderer.setScissorTest(false);
    g.renderer.setViewport(0, 0, size.x, size.y);
    budgets.push(+(performance.now() - f0).toFixed(1));
    await frame();
  }
  const passMs = performance.now() - t0;
  g.scene.remove(warmRoot);

  const afterPass = {
    work: work.length,
    proxies,
    passMs: +passMs.toFixed(0),
    frames: budgets.length,
    worstFrameMs: Math.max(...budgets),
    worstDrawMs: Math.max(...draws),
    over50: budgets.filter((b) => b > 50).length,
    drawnProgramsDelta: g.renderer.info.programs.length - programsBefore,
    programs: g.renderer.info.programs.length,
  };

  // -------------------------------------------------------------- act tour
  window.__FETCH.start();
  await g.entryPromise;
  await wait(800);
  const steps = [];
  for (const act of ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
    const b = g.renderer.info.programs.length;
    const gb = g.renderer.info.memory.geometries;
    g.teleport(act);
    const r0 = performance.now();
    await frame(); await frame();
    const drawMs = performance.now() - r0;
    for (let i = 0; i < 40; i++) await frame();
    await wait(200);
    steps.push({
      act, drawMs: +drawMs.toFixed(0),
      addedPrograms: g.renderer.info.programs.length - b,
      addedGeometries: g.renderer.info.memory.geometries - gb,
    });
  }
  return { afterPass, steps, budgets, hitches: window.__FETCH.hitches() };
});

await browser.close();
server.stop();

const a = report.afterPass;
console.log(`warm-draw list: ${a.work} draws (${a.proxies} staged as proxies) from 2184 meshes`);
console.log(`pass: ${a.passMs}ms over ${a.frames} frames, worst frame ${a.worstFrameMs}ms, worst single draw ${a.worstDrawMs}ms, ${a.over50} frames over 50ms`);
console.log(`programs: +${a.drawnProgramsDelta} during the pass -> ${a.programs} total`);
console.log('  (a large + here means the pass warmed variants the game does not use — proxy mismatch)');
console.log('\nact tour AFTER the pass:');
for (const s of report.steps) {
  console.log(`  ${s.act.padEnd(10)} first draws ${String(s.drawMs).padStart(5)}ms  +${s.addedPrograms} programs  +${s.addedGeometries} geometries`);
}
console.log('\nhitch log (frames over 150ms, whole run):');
for (const h of report.hitches) console.log(`  ${String(h.ms).padStart(5)}ms  t=${h.at}s  ${String(h.act).padEnd(10)} +${h.programs}p +${h.geometries}g +${h.textures}t`);
if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));
writeFileSync(resultsPath('warm-draw.json'), JSON.stringify(report, null, 2));

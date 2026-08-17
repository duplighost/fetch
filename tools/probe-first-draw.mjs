// probe-first-draw.mjs -- EXPERIMENT, not a gate. What is the per-act stall
// actually made of, once the shader warmup is no longer being cancelled?
//
// The cold-start probe separated the CPU build from the GPU first draw and the
// answer was blunt: building a district costs 0-6 ms and DRAWING it for the
// first time costs 600-1400 ms. compile() links programs and initTexture()
// uploads pixels, but nothing in the warm pass ever DRAWS the hidden districts,
// so their first frame is where the driver finally does its real work.
//
// This asks one question: if the title screen draws every hidden object once,
// do the per-act stalls go away? It flips visibility itself, from the page, so
// the answer arrives before any of it is written into the game.
//
// THE TRAP IT AVOIDS: revealing a hidden GROUP exposes every light beneath it,
// which moves the shader light census and recompiles the entire game. So every
// light inside the revealed set is pinned invisible for the pass and restored
// exactly. A program count that explodes in the report means that guard leaked.
//
//   node tools/probe-first-draw.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1&hitch=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
await page.waitForFunction(() => window.__game.shaderWarmup.status !== 'scheduled', null, { timeout: 90000, polling: 100 });
await page.waitForFunction(() => ['ready', 'degraded'].includes(window.__game.shaderWarmup.status), null, { timeout: 90000, polling: 100 });

const report = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const before = {
    programs: g.renderer.info.programs.length,
    geometries: g.renderer.info.memory.geometries,
  };

  // ---- the pass under test: draw everything once, in chunks --------------
  // NOT just the hidden ones. The first version of this probe revealed hidden
  // objects and rendered, and the per-act stalls survived untouched — because
  // the cave sits at z=245 and the mirror room at 499, so revealing them from
  // the bedroom camera only made them frustum-culled instead of hidden. A
  // culled object is never drawn, and it is the DRAW that costs: three's
  // compile() links a GL program, but ANGLE/D3D11 defers the real shader
  // compile until the program is first used with a given input layout. So the
  // pass has to force frustumCulled = false as well as visible = true.
  const hidden = [];
  g.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) hidden.push(o); });
  const chunkReport = [];
  const CHUNK = 40;
  const t0 = performance.now();
  for (let i = 0; i < hidden.length; i += CHUNK) {
    const chunk = hidden.slice(i, i + CHUNK);
    const restore = [];
    const culled = [];
    const reveal = (object) => { restore.push([object, object.visible]); object.visible = true; };
    const counts = [];
    const matVis = [];
    for (const object of chunk) {
      reveal(object);
      culled.push([object, object.frustumCulled]);
      object.frustumCulled = false;
      // three skips an InstancedMesh whose count is 0 and an object whose
      // material.visible is false — both are how this game holds a thing back
      // until its beat (the seal GROWS its count; the mica trail grows toward
      // the way out). A held-back object is never drawn, so its shader never
      // meets the driver until the beat fires.
      if (object.isInstancedMesh && object.count === 0) {
        counts.push([object, object.count]);
        object.count = 1;
      }
      for (const m of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (m && m.visible === false) { matVis.push([m, m.visible]); m.visible = true; }
      }
      for (let p = object.parent; p && p !== g.scene; p = p.parent) if (!p.visible) reveal(p);
      // Every light that this reveal would expose gets pinned dark first.
      object.traverse((child) => {
        if (child.isLight && child.visible) { restore.push([child, child.visible]); child.visible = false; }
      });
    }
    const c0 = performance.now();
    g.renderer.render(g.scene, g.camera);
    const ms = performance.now() - c0;
    for (let k = restore.length - 1; k >= 0; k--) restore[k][0].visible = restore[k][1];
    for (const [object, was] of culled) object.frustumCulled = was;
    for (const [object, was] of counts) object.count = was;
    for (const [material, was] of matVis) material.visible = was;
    if (ms > 40) chunkReport.push({ at: i, ms: +ms.toFixed(0) });
    await frame();
  }
  const passMs = performance.now() - t0;

  const afterPass = {
    programs: g.renderer.info.programs.length,
    geometries: g.renderer.info.memory.geometries,
    hidden: hidden.length,
    passMs: +passMs.toFixed(0),
    worstChunkMs: chunkReport.reduce((n, c) => Math.max(n, c.ms), 0),
    chunksOver40ms: chunkReport.length,
  };

  // ---- now play the same act tour and see what is left -------------------
  window.__FETCH.start();
  await g.entryPromise;
  await wait(800);
  const steps = [];
  for (const act of ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
    const b = g.renderer.info.programs.length;
    const gb = g.renderer.info.memory.geometries;
    g.teleport(act);
    const r0 = performance.now();
    await frame();
    await frame();
    const drawMs = performance.now() - r0;
    for (let i = 0; i < 40; i++) await frame();
    await wait(200);
    steps.push({
      act,
      drawMs: +drawMs.toFixed(0),
      addedPrograms: g.renderer.info.programs.length - b,
      addedGeometries: g.renderer.info.memory.geometries - gb,
    });
  }
  return { before, afterPass, steps, hitches: window.__FETCH.hitches() };
});

await browser.close();
server.stop();

console.log(`before pass: ${report.before.programs} programs, ${report.before.geometries} geometries`);
console.log(`draw-everything pass: ${report.afterPass.hidden} hidden objects, ${report.afterPass.passMs}ms total, `
  + `worst chunk ${report.afterPass.worstChunkMs}ms (${report.afterPass.chunksOver40ms} chunks over 40ms)`);
console.log(`after pass:  ${report.afterPass.programs} programs, ${report.afterPass.geometries} geometries`);
console.log(`             (+${report.afterPass.programs - report.before.programs} programs — a big number here means the light guard leaked)`);
console.log('\nact tour AFTER the pass:');
for (const s of report.steps) {
  console.log(`  ${s.act.padEnd(10)} first draws ${String(s.drawMs).padStart(5)}ms  +${s.addedPrograms} programs  +${s.addedGeometries} geometries`);
}
console.log('\nhitch log:');
for (const h of report.hitches) {
  console.log(`  ${String(h.ms).padStart(5)}ms  t=${h.at}s  ${String(h.act).padEnd(10)} +${h.programs}p +${h.geometries}g +${h.textures}t`);
}
if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));
writeFileSync(resultsPath('first-draw.json'), JSON.stringify(report, null, 2));

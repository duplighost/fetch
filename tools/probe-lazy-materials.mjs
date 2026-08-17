// probe-lazy-materials.mjs -- name the materials whose FIRST DRAW is a stall.
//
// After the start gate stopped cancelling the shader warmup, ~17 programs still
// compiled during play, and probe-first-draw proved they are the whole cost:
// drawing every hidden object once (293 geometry uploads, 208 ms) changed
// nothing, while acts that link 2-5 new programs still cost 550-1500 ms. So the
// remaining freezes are a handful of materials that do not exist yet when the
// warm pass runs, and each one costs the driver ~350-700 ms at first sight.
//
// renderer.info.programs cannot name them (WebGLProgram.name is material.name,
// and these are unnamed). Patching Material.prototype.onBeforeCompile does name
// them, but it also CHANGES EVERY PROGRAM CACHE KEY -- three hashes that
// function's source into the key -- so the instrument recompiles the whole game
// (255 -> 343 programs) and its own list is then mostly its own fault. Tried,
// discarded, recorded here so nobody tries it twice.
//
// The honest instrument is an inventory diff. The warm pass compiles by
// scene.traverse(), which ignores visibility, so ANY material reachable from a
// live graph at warm time is already compiled. A program that links during play
// therefore belongs to a material that was not reachable then -- one built or
// attached later. Snapshot the reachable set at warm time, diff it per act, and
// the late materials name themselves with their owners attached.
//
//   node tools/probe-lazy-materials.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1&hitch=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
await page.waitForFunction(() => ['ready', 'degraded'].includes(window.__game.shaderWarmup.status),
  null, { timeout: 90000, polling: 100 });

const report = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const roots = () => [g.scene, g.grainScene, g.skull.root].filter(Boolean);
  // uuid -> {material, owners}: every material reachable right now.
  const inventory = () => {
    const found = new Map();
    for (const root of roots()) {
      root.traverse?.((object) => {
        const list = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
        for (const material of list) {
          if (!found.has(material.uuid)) found.set(material.uuid, { material, owners: [] });
          const entry = found.get(material.uuid);
          if (entry.owners.length < 4) {
            const chain = [];
            for (let p = object; p && chain.length < 4; p = p.parent) chain.push(p.name || p.type);
            entry.owners.push(chain.join(' < '));
          }
        }
      });
    }
    return found;
  };
  const describe = (entry, act) => ({
    act,
    type: entry.material.type,
    name: entry.material.name || '',
    transparent: !!entry.material.transparent,
    color: entry.material.color ? '#' + entry.material.color.getHexString() : null,
    map: entry.material.map ? (entry.material.map.name || 'texture') : null,
    owners: entry.owners,
  });

  // The exact instrument: wrap renderBufferDirect and watch the program count
  // across every single draw. Whichever draw grows it IS the stall, and it
  // hands over the object and material that caused it. (Wrapping is safe here
  // in a way that patching onBeforeCompile is not: it changes no cache key.)
  const culprits = [];
  const originalDraw = g.renderer.renderBufferDirect.bind(g.renderer);
  g.renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    const before = g.renderer.info.programs.length;
    const t0 = performance.now();
    const out = originalDraw(camera, scene, geometry, material, object, group);
    const ms = performance.now() - t0;
    if (g.renderer.info.programs.length > before || ms > 80) {
      const chain = [];
      for (let p = object; p && chain.length < 5; p = p.parent) chain.push(p.name || p.type);
      culprits.push({
        act: g.act,
        ms: +ms.toFixed(0),
        camera: `${camera.name || camera.type}#${camera.id} layers=${camera.layers.mask} main=${camera === g.camera}`,
        target: g.renderer.getRenderTarget()?.texture?.colorSpace || 'screen',
        linked: g.renderer.info.programs.length - before,
        material: material.type,
        materialName: material.name || '',
        transparent: !!material.transparent,
        side: material.side,
        fog: material.fog !== false,
        instanced: !!object.isInstancedMesh,
        count: object.isInstancedMesh ? object.count : 1,
        object: chain.join(' < '),
        cacheKey: (material.__fetchKey = g.renderer.info.programs[g.renderer.info.programs.length - 1]?.cacheKey || '').slice(-70),
      });
    }
    return out;
  };

  const warm = new Set(inventory().keys());
  window.__FETCH.start();
  await g.entryPromise;
  await wait(600);
  for (const uuid of inventory().keys()) warm.add(uuid);     // entry itself is warm now

  const steps = [];
  const late = [];
  for (const act of ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
    const beforePrograms = g.renderer.info.programs.length;
    g.teleport(act);
    const t0 = performance.now();
    await frame(); await frame();
    const drawMs = performance.now() - t0;
    for (let i = 0; i < 30; i++) await frame();
    await wait(200);
    const first = late.length;
    for (const [uuid, entry] of inventory()) {
      if (warm.has(uuid)) continue;
      warm.add(uuid);
      late.push(describe(entry, act));
    }
    steps.push({
      act,
      drawMs: +drawMs.toFixed(0),
      addedPrograms: g.renderer.info.programs.length - beforePrograms,
      first,
      last: late.length,
    });
  }

  g.renderer.renderBufferDirect = originalDraw;
  return { steps, late, culprits, programs: g.renderer.info.programs.length, hitches: window.__FETCH.hitches() };
});

await browser.close();
server.stop();

for (const s of report.steps) {
  const mine = report.late.slice(s.first, s.last);
  console.log(`\n=== ${s.act}  first draws ${s.drawMs}ms  +${s.addedPrograms} programs  (+${mine.length} late materials)`);
  for (const m of mine) {
    console.log(`   ${m.type}${m.name ? ' "' + m.name + '"' : ''}  ${m.transparent ? 'transparent ' : ''}${m.color || ''}${m.map ? ' map' : ''}`);
    for (const owner of m.owners) console.log(`        owner: ${owner}`);
    if (!m.owners.length) console.log('        owner: (not in any live graph — built and drawn, or already disposed)');
  }
}
console.log('\n=== the draws that linked a program (or took over 80ms) ===');
for (const c of report.culprits) {
  console.log(`  ${String(c.ms).padStart(5)}ms  ${c.act.padEnd(9)} +${c.linked}  ${c.material}${c.materialName ? ' "' + c.materialName + '"' : ''}`
    + `  ${c.transparent ? 'transparent ' : ''}side=${c.side} fog=${c.fog}${c.instanced ? ` INSTANCED x${c.count}` : ''}`);
  console.log(`          ${c.object}`);
  console.log(`          camera: ${c.camera}   target: ${c.target}`);
  console.log(`          ...${c.cacheKey}`);
}
console.log(`\nprograms: ${report.programs}`);
if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));
writeFileSync(resultsPath('lazy-materials.json'), JSON.stringify(report, null, 2));

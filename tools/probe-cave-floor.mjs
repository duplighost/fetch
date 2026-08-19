// probe-cave-floor.mjs -- is the cave's floor drawn at all?
//
// installCaveVisibility (underfalls.js ~1350) spares the world's shared rock
// batch from the cave's hide with `child.material === game.mats.rock`. But
// world.finishStatic() merges under `mat.clone()` (world.js:99), so that
// identity can never hold. If the clause never fires, the batch carrying the
// route treads, the roofs, the side-wall backing and the chamber caps is
// hidden for the whole cave act, and the player walks a lit ribbon between two
// unlit gutters.
//
// Reasoned from source by a round-eleven audit, NOT rendered. This renders it.
//
//   node tools/probe-cave-floor.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });

const out = await page.evaluate(() => {
  const F = window.__FETCH, g = window.__game;
  const shells = () => g.scene.children
    .filter((c) => c.isMesh && c.material?.vertexColors)
    .map((c) => ({
      name: c.name || c.material?.name || '(anon)',
      mat: c.material?.name || '',
      verts: c.geometry?.attributes?.position?.count ?? 0,
      visible: c.visible,
      isRockShell: c.material?.name === 'rock:shell' || /rock/i.test(c.material?.name || ''),
    }));

  F.start();
  const before = shells();
  F.teleport('cave');
  F.stepWith(0.6, {}, false);
  const during = shells();
  F.teleport('graveyard');
  F.stepWith(0.4, {}, false);
  const after = shells();

  // and the identity the clause tests
  const rockMat = g.mats.rock;
  const identity = during.map((s) => s.name).length;
  const shellIsClone = g.scene.children.some((c) => c.isMesh && c.material && c.material !== rockMat
    && /rock/i.test(c.material.name || ''));

  // what does the cave actually draw?
  F.teleport('cave');
  F.stepWith(0.6, {}, false);
  for (let i = 0; i < 3; i++) g.render();
  const caveDraws = g.lastRender?.drawCalls ?? -1;
  const shot = g.renderer.domElement.toDataURL('image/png');
  return { before, during, after, shellIsClone, caveDraws, shot, rockMatName: rockMat?.name || '' };
});

await browser.close();
server.stop();

const fmt = (rows) => rows.map((r) => `      ${r.visible ? 'VISIBLE' : 'HIDDEN '}  ${String(r.verts).padStart(7)} verts  mat=${r.mat}  ${r.name}`).join('\n');
console.log(`game.mats.rock is named: "${out.rockMatName}"`);
console.log(`a rock-ish shell material distinct from mats.rock exists: ${out.shellIsClone}`);
console.log(`\nvertex-coloured shells BEFORE entering the cave:\n${fmt(out.before)}`);
console.log(`\n...WHILE IN THE CAVE:\n${fmt(out.during)}`);
console.log(`\n...after leaving:\n${fmt(out.after)}`);
console.log(`\ncave draw calls: ${out.caveDraws}`);
writeFileSync(shotPath('cave-floor-now'), Buffer.from(out.shot.split(',')[1], 'base64'));
console.log(`shot: ${shotPath('cave-floor-now')}`);
if (errors.length) console.log('errors: ' + errors.slice(0, 4).join(' | '));

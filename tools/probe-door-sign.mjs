// probe-door-sign.mjs -- LOOK at the NO FURNACE sign. His request, verbatim:
// "we sshould actually take a screenshot or something to make sure you put the
// sign in the right place on the door and that it goes away when the door opens"
//
// Two things to see, and they are different questions:
//   1. is the plate in the right place on the closed door, and is it legible
//      from where a player actually stands on the stairs?
//   2. does it GO AWAY when the door opens? The plate is a child of door.panel,
//      so it swings WITH the door rather than vanishing -- which may or may not
//      read as "gone" depending on where the panel ends up. That cannot be
//      settled from source. Look at it.
//
// WebGL canvas readback, never page.screenshot -- headless composites the
// canvas black.
//   node tools/probe-door-sign.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const outDir = join(process.cwd(), 'shots', 'door-sign');
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });

const out = await page.evaluate(() => {
  const F = window.__FETCH, g = window.__game;
  F.start();
  F.stepWith(0.3, {}, false);

  const door = g.world.doorById.voidDoor;
  const V = g.player.pos.constructor;
  const frames = {}, notes = [];

  let plate = null;
  door.panel.traverse((o) => { if (/works plate/i.test(o.name || '')) plate = plate || o; });

  const settle = () => { g._shake = 0; g.fovKick = 0; for (let i = 0; i < 6; i++) g.render(); };
  const shoot = (name) => { settle(); frames[name] = g.renderer.domElement.toDataURL('image/png'); };

  // stand where a player stands: on the stairs, looking at the door
  const look = (from, at) => {
    g.player.pos.set(from[0], from[1], from[2]);
    g.camera.position.set(from[0], from[1] + 1.6, from[2]);
    g.camera.lookAt(new V(at[0], at[1], at[2]));
    g.camera.updateMatrixWorld(true);
  };

  // ON THE RAMP, NOT FLOATING AT FIRST-FLOOR LEVEL. Every pose below used to
  // put the feet at 3.6, but (2.6,-4.4) and (3.6,-5.6) are both inside the
  // main stair shaft, and HOUSE_TABLES.ramps.mainStairs runs y 0 -> 3.6 over
  // world z -10 -> -2. A real player at z=-4.4 stands at 2.52 and at z=-5.6
  // at 1.98, so the old shots read the plate from 1.1-1.6 m too high and far
  // squarer-on than anyone ever will. Same lerp the world compiler uses
  // (world.js groundHeightAt).
  const stairY = (z) => 3.6 * Math.min(1, Math.max(0, (z + 10) / 8));

  const plateWorld = () => {
    if (!plate) return null;
    const p = plate.getWorldPosition(new V());
    return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
  };

  const doorPos = door.group.position;
  notes.push(`door hinge at ${doorPos.x.toFixed(2)},${doorPos.y.toFixed(2)},${doorPos.z.toFixed(2)}`);
  notes.push(`plate found: ${!!plate}${plate ? ' name=' + plate.name : ''}`);

  // ---- CLOSED ----
  door.setOpen(false);
  door.panel.rotation.y = 0;
  door.panel.updateMatrixWorld(true);
  notes.push(`CLOSED plate world ${JSON.stringify(plateWorld())}`);
  look([2.6, stairY(-4.4), -4.4], [4.0, 4.75, -7.0]);
  shoot('1-closed-from-stairs');
  look([3.6, stairY(-5.6), -5.6], [4.0, 4.75, -7.0]);
  shoot('2-closed-close');

  // ---- OPEN ----
  door.setOpen(true);
  for (let i = 0; i < 90; i++) F.stepWith(1 / 60, {}, false);
  door.panel.updateMatrixWorld(true);
  notes.push(`OPEN  panel.rotation.y=${door.panel.rotation.y.toFixed(3)} open=${door.open}`);
  notes.push(`OPEN  plate world ${JSON.stringify(plateWorld())}`);
  look([2.6, stairY(-4.4), -4.4], [4.0, 4.75, -7.0]);
  shoot('3-open-from-stairs');
  look([3.6, stairY(-5.6), -5.6], [4.0, 4.75, -7.0]);
  shoot('4-open-close');

  return { frames, notes };
});

for (const [name, url] of Object.entries(out.frames)) {
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
for (const n of out.notes) console.log(' ', n);
console.log('\nwrote', Object.keys(out.frames).length, 'frames to', outDir);
if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 4));
await browser.close(); await server?.close?.();

// probe-cave-door.mjs -- his note 4: "I died entering the cave", "I walked
// behind the first wall", and "it loads 2 distinct things, one before the
// other". Reproduce on foot before touching anything.
//
// Three questions, in the order they have to be answered:
//   1. Walk the crossing and log act / zone / ground / y every tenth of a
//      second. WHERE does the floor go away, and what act owns the death?
//   2. Strafe the mouth of the stone veil at a dozen offsets and find the
//      gap that let him behind the wall — then look BACK through it, because
//      an un-backed opening shows the renderer's clear colour, which is what
//      his third screenshot (a giant untextured orange surface) looks like.
//   3. Capture the act line frame by frame with the program census and the
//      visible-light count either side of it, so "two distinct things, one
//      before the other" gets named instead of guessed at.
//
//   node tools/probe-cave-door.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'scratch-cave-door';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });

  const report = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('clearing');
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    // THE FALLS MUST BE THAWED FIRST, or the ice sheet is still hanging across
    // the mouth and every shot of the cave is a photograph of it. (That sheet
    // is a 6.2 x 19 m box: skipping this made the approach look like one flat
    // untextured wall — which is what his own screenshot of the entrance shows,
    // and it cost an hour to tell the two apart.) The flag is the game's own
    // reload-past-the-thaw path.
    g.flag('fallsThawed');
    F.stepWith(0.3, {}, false);
    // the bargain, then let the stones finish rising
    g.director.waterfallTaken();
    for (let t = 0; t < 12; t += 0.1) F.stepWith(0.1, {}, false);
    const C = g.clearingCenter;

    const zoneAt = (x, z, y) => (g.world.zones || [])
      .filter((zone) => zone.enabled !== false
        && x >= zone.min.x && x <= zone.max.x
        && z >= zone.min.z && z <= zone.max.z
        && y >= zone.min.y && y <= zone.max.y)
      .map((zone) => zone.name).join('+') || '(none)';

    // ---- 1. the crossing, logged --------------------------------------
    const place = (x, z) => {
      g.dead = false;
      g.player.pos.set(x, g.world.groundHeightAt(x, z, 2) + 0.05, z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.yaw = Math.PI;                    // due north (+z)
      g.player._sync(0);
    };
    place(C.x, C.z + 2);
    const walk = [];
    let died = null;
    for (let t = 0; t < 26; t += 0.1) {
      F.stepWith(0.1, { moveZ: 1 }, false);
      const p = g.player.pos;
      walk.push({
        t: +t.toFixed(1),
        z: +(p.z - C.z).toFixed(2),
        x: +(p.x - C.x).toFixed(2),
        y: +p.y.toFixed(2),
        ground: +g.world.groundHeightAt(p.x, p.z, 2).toFixed(2),
        act: g.act,
        zone: zoneAt(p.x, p.z, p.y),
      });
      if (g.dead && !died) { died = walk[walk.length - 1]; break; }
      if (p.z - C.z > 34) break;
    }

    // ---- 2. the mouth, strafed ----------------------------------------
    // Walk NORTH at a series of x offsets and record how far each one gets.
    const lanes = [];
    for (let dx = -7; dx <= 7; dx += 0.5) {
      place(C.x + dx, C.z + 16.5);
      let maxZ = g.player.pos.z - C.z;
      let dead = false;
      for (let t = 0; t < 14; t += 0.1) {
        F.stepWith(0.1, { moveZ: 1 }, false);
        maxZ = Math.max(maxZ, g.player.pos.z - C.z);
        if (g.dead) { dead = true; break; }
        if (g.player.pos.z - C.z > 30) break;
      }
      lanes.push({
        dx: +dx.toFixed(1),
        reached: +maxZ.toFixed(2),
        endX: +(g.player.pos.x - C.x).toFixed(2),
        act: g.act,
        dead,
      });
      g.dead = false;
    }

    // ---- 3. the act line, frame by frame -------------------------------
    const shots = [];
    const look = (px, pz, tx, ty, tz, outside = false) => {
      // Teleporting back to the act is the only thing that actually puts the
      // act back: a pose set by hand keeps whatever act the walk above left
      // behind, and every approach shot would be taken with the outside world
      // hidden by the cave seal.
      if (outside) { F.teleport('clearing'); F.stepWith(0.3, {}, false); }
      g.dead = false;
      g.player.pos.set(px, g.world.groundHeightAt(px, pz, 3) + 0.05, pz);
      g.player.vel.set(0, 0, 0);
      const ey = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
      g.player.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(ty - ey, Math.hypot(tx - px, tz - pz))));
      g.player._sync(0);
    };
    const shoot = (name) => {
      // The act is sticky: once this probe has walked into the cave, standing
      // back out on the stones does not by itself put the act back, and every
      // approach shot would then be photographed with the outside HIDDEN. Let
      // the zone re-assert itself before the shutter.
      F.stepWith(0.2, {}, false);
      F.stepWith(0.2, {}, false);
      F.stepWith(0.2, {}, false);
      g.render();
      shots.push({
        name,
        png: g.renderer.domElement.toDataURL('image/png'),
        act: g.act,
        programs: g.renderer.info.programs.length,
        draws: g.lastRender.drawCalls,
      });
    };

    look(C.x, C.z + 14, C.x, 3, C.z + 24, true);
    shoot('01-approach-from-the-stones');
    look(C.x, C.z + 19.4, C.x, 2.2, C.z + 26, true);
    shoot('02-under-the-veil');
    look(C.x, C.z + 21.5, C.x, 2.0, C.z + 30);
    shoot('03-just-inside');
    look(C.x, C.z + 23.5, C.x, 2.0, C.z - 6);
    shoot('04-looking-back-out');
    look(C.x + 5.5, C.z + 22.5, C.x - 6, 2.0, C.z + 22.5);
    shoot('05-behind-the-east-wall');
    look(C.x - 5.5, C.z + 22.5, C.x + 6, 2.0, C.z + 22.5);
    shoot('06-behind-the-west-wall');
    look(C.x + 6.5, C.z + 21, C.x + 6.5, 2.0, C.z + 34);
    shoot('07-east-of-the-mouth-looking-in');

    // the transition itself, sampled every frame across the act line
    const transition = [];
    place(C.x, C.z + 17.5);
    for (let t = 0; t < 6; t += 0.1) {
      F.stepWith(0.1, { moveZ: 1 }, false);
      g.render();
      transition.push({
        z: +(g.player.pos.z - C.z).toFixed(2),
        act: g.act,
        programs: g.renderer.info.programs.length,
        draws: g.lastRender.drawCalls,
        geometries: g.renderer.info.memory.geometries,
        caveRoots: (g.underfalls?.renderRoots || []).filter((r) => r.visible).length,
        caveLights: (g.underfalls?.lights || []).filter((l) => l.visible).length,
        outsideHidden: g.underfalls?.visibility?.active === true,
      });
      if (g.player.pos.z - C.z > 26) break;
    }

    return { walk, died, lanes, shots, transition, bounds: g.underfalls.layout.bounds, C: { x: C.x, z: C.z } };
  });

  for (const s of report.shots) {
    const file = join(outDir, `${s.name}.png`);
    writeFileSync(file, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`wrote ${file}   act=${s.act} draws=${s.draws} programs=${s.programs}`);
  }

  console.log('\n--- the crossing, north up the lane ---');
  let lastAct = null;
  for (const w of report.walk) {
    if (w.act !== lastAct) { console.log(`  ACT -> ${w.act} at z${w.z}`); lastAct = w.act; }
    if (w.y < -0.9 || w.z > 18) {
      console.log(`   t${w.t} z${w.z} x${w.x} y${w.y} ground${w.ground} ${w.act} [${w.zone}]`);
    }
  }
  console.log(report.died ? `  DIED: ${JSON.stringify(report.died)}` : '  never died walking the lane');

  console.log('\n--- how far north each offset gets ---');
  for (const l of report.lanes) {
    console.log(`  dx ${String(l.dx).padStart(5)}  reached z${String(l.reached).padStart(6)}  endX ${String(l.endX).padStart(6)}  ${l.act}${l.dead ? '  DIED' : ''}`);
  }

  console.log('\n--- across the act line ---');
  let prev = null;
  for (const s of report.transition) {
    const changed = !prev || s.act !== prev.act || s.programs !== prev.programs
      || s.caveRoots !== prev.caveRoots || s.caveLights !== prev.caveLights
      || s.outsideHidden !== prev.outsideHidden;
    if (changed) {
      console.log(`  z${s.z}  ${s.act}  programs ${s.programs}  draws ${s.draws}  geo ${s.geometries}`
        + `  caveRoots ${s.caveRoots}  caveLights ${s.caveLights}  outsideHidden ${s.outsideHidden}`);
    }
    prev = s;
  }
  if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));
  writeFileSync(resultsPath('cave-door.json'), JSON.stringify({ ...report, shots: undefined }, null, 2));
} finally {
  await browser.close();
  server.stop();
}

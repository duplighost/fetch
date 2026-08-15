// shot-opening.mjs — the wake, and every reveal in it, as pixels.
//   node tools/shot-opening.mjs <outDir>
// The bedroom cannot be shot with shot-room.mjs: F.teleport('bedroom') runs the
// arrival's completeInstant() contract and hands back the POST-arrival room
// (glass burst, bell spent). This boots the real thing and drives the search
// chain through the registered interacts, in order, capturing each state
// change at the pose a player would be standing in when they cause it.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '_shots/opening';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true,
    null, { timeout: 60000, polling: 200 });

  const shots = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    const out = [];
    const shoot = async (name) => { await F.step(1 / 60, 4); g.render(); out.push({ name, png: g.renderer.domElement.toDataURL('image/png') }); };
    const pose = (x, z, yaw, pitch) => {
      g.player.pos.set(x, 3.6, z); g.player.vel.set(0, 0, 0); g.player.fallV = 0;
      g.player.yaw = yaw; g.player.pitch = pitch; g.player._sync(0);
    };
    const look = (sx, sz, tx, ty, tz) => {       // stand here, put the crosshair there
      g.player.pos.set(sx, 3.6, sz); g.player.vel.set(0, 0, 0); g.player.fallV = 0;
      g.player._sync(0);
      const c = g.camera.getWorldPosition(new g.skull.pos.constructor());
      const dx = tx - c.x, dy = ty - c.y, dz = tz - c.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    const use = (id) => {
      for (const o of g.world.interactables) {
        const it = o.userData.inter;
        if (it && it.id === id && it.enabled !== false) { it.action(g); return true; }
      }
      return false;
    };

    F.start();
    await F.step(1 / 60, 12);

    // 1. THE WAKE — the untouched spawn pose, frame one of the game
    await shoot('01-wake');
    g.player.pitch = -0.5; g.player._sync(0);
    await shoot('02-wake-look-down');            // am I standing in the bed?

    // 2. the bed's west flank AND the floor beside it in one frame — the whole
    // point of the covers drag is where the cloth ends up
    pose(8.6, 4.6, -0.862, -0.585);
    await shoot('03-bed-before');
    use('search:covers');
    await F.step(1 / 60, 34);                     // mid-drag
    await shoot('04-covers-mid');
    await F.step(1 / 60, 90);
    await shoot('05-covers-done');
    pose(9.35, 3.35, -Math.PI / 2, -0.32);        // and the mattress it left behind
    await shoot('05b-imprint');

    // 3. the rug corner, from the foot of the bed — the pose the tests use
    look(10.4, 1.25, 10.65, 3.64, 2.02);
    await shoot('06-rug-before');
    use('search:rug');
    await F.step(1 / 60, 25);
    await shoot('07-rug-mid');
    await F.step(1 / 60, 90);
    await shoot('08-rug-done');                   // folded WEST, board proud
    look(9.6, 1.5, 9.4, 3.75, 2.1);               // and the folded flap where it lands
    await shoot('08b-flap-landed');

    // 4. the floorboard and what is under it
    look(10.3, 1.35, 10.6, 3.64, 2.16);
    await shoot('09-board-before');
    use('search:floorboard');
    await F.step(1 / 60, 28);
    await shoot('10-board-mid');
    await F.step(1 / 60, 90);
    await shoot('11-board-done');                 // hinged UP, bell in the cavity

    const A = g.bedroomArrival;
    return {
      shots: out,
      state: {
        arrival: A.state, bellFound: A.bellFound, searched: A.searchedCount,
        boardRot: +g.bedroomProps.board.pivot.rotation.z.toFixed(4),
        flapRot: +g.bedroomProps.rug.flap.rotation.z.toFixed(4),
        coversHeap: g.bedroomProps.covers.heap.visible,
        bellVisible: g.bedroomProps.bell.group.visible,
        glint: (g.world.windowOpenings.find((o) => o.id === 'bedroomWindow') || {}).glint?.visible,
      },
    };
  });

  for (const s of shots.shots) {
    writeFileSync(`${outDir}/${s.name}.png`, Buffer.from(s.png.split(',')[1], 'base64'));
  }
  console.log('wrote', shots.shots.length, 'shots to', outDir);
  console.log(JSON.stringify(shots.state, null, 2));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
  process.exit(errors.length ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

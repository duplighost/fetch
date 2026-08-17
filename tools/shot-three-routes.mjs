// shot-three-routes.mjs — the yard after the funeral, as pixels.
//   node tools/shot-three-routes.mjs <outDir>
// Boots, resolves the graveyard, lets the three-route reveal play out, then
// stands where a player would stand at each of the new things and looks at it.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '_shots/three-routes';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true,
    null, { timeout: 60000, polling: 200 });

  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    const shots = [];
    const shoot = async (name) => { await F.step(1 / 60, 4); g.render(); shots.push({ name, png: g.renderer.domElement.toDataURL('image/png') }); };
    const look = (sx, sz, tx, ty, tz, sy = null) => {
      const y = sy == null ? g.world.groundHeightAt(sx, sz, 3) : sy;
      g.player.pos.set(sx, y, sz);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0;
      g.player._sync(0);
      const c = g.camera.getWorldPosition(new g.skull.pos.constructor());
      const dx = tx - c.x, dy = ty - c.y, dz = tz - c.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };

    F.start();
    F.teleport('graveyard');
    await F.step(1 / 60, 8);
    g.skull.holdNow();

    // the canine in the rubble of the sixth hero grave, before anything else
    const grave = g.destructibleGraves[5];
    grave.hits = 2;
    await F.step(1 / 60, 90);
    look(18.5, 34.6, 18.52, 0.95, 37.5);
    await shoot('01-iron-canine-in-the-rubble');

    // the funeral resolves; the three routes reveal in order
    g.director._completeGraveyard('loud');
    look(6.4, 21.0, 5.8, 5.4, 13.4);
    await F.step(1 / 60, 150);
    await shoot('02-the-tree-lets-a-branch-down');
    // where the player stands to throw at it: the limb across the sky, the key
    // up near the leaves
    {
      const climb = g.keyTreeClimb;
      const hang = climb.branchTarget.pos;
      look(6.9, 19.2, hang.x, hang.y, hang.z);
      await shoot('03-the-branch-at-throwing-height');
      climb.tear(hang.clone());
      await F.step(1 / 60, 210);
      look(6.6, 18.4, climb.keyRest.x, 0.6, climb.keyRest.z);
      await shoot('04-the-key-and-the-bones-in-the-grass');
    }

    // the east mausoleum's seal, given by the funeral, and the way down
    look(15.6, 27.6, 15.6, 1.1, 29.6);
    await shoot('05-the-seal-gave');
    look(15.6, 30.6, 15.6, 0.02, 31.95);
    await shoot('06-the-floor-is-the-way-down');

    // the lock-stone at the gate, empty and then full
    look(2.0, 38.6, -0.35, 1.32, 41.3);
    await shoot('07-the-lock-stone-empty');
    for (const s of g.gateKeys.sockets) s.filled = true;
    g.gateKeys.restore();
    await F.step(1 / 60, 10);
    look(2.0, 38.6, -0.35, 1.32, 41.3);
    await shoot('08-the-lock-stone-full');

    return {
      shots,
      state: {
        dropped: g.keyTreeClimb.dropped,
        branchFelled: g.keyTreeClimb.hit,
        keyFetchable: g.gateKeys.list[2].target.enabled,
        sealOpen: g.sealedMausoleumSeal.open,
        banked: g.gateKeys.banked(),
        draws: g.lastRender ? g.lastRender.drawCalls : null,
      },
    };
  });

  for (const s of out.shots) {
    writeFileSync(`${outDir}/${s.name}.png`, Buffer.from(s.png.split(',')[1], 'base64'));
  }
  console.log('wrote', out.shots.length, 'shots to', outDir);
  console.log(JSON.stringify(out.state, null, 2));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
  process.exit(errors.length ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

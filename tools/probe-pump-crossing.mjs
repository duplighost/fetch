// HIS BUG, driven exactly as he described it: weigh the cradle, watch the gate
// come up, LET GO, then walk across. Before the round-nine fix the arrival
// latched nothing, because route.progress had rewound below 0.9 by the time
// the player reached the far bank.
//
// Also samples the gallery floor so the vermin can be seeded on real ground.
//   node tools/probe-pump-crossing.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
let page;
try {
  const opened = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  page = opened.page;
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const route = g.pumpGallery;
    F.start();
    F.teleport('basement');
    g.enemies.list.length = 0;
    g.flag('crawlSecretSolved');

    const seat = (x, z, yaw, pitch = 0) => {
      g.player.pos.set(x, -3, z);
      g.player.yaw = yaw; g.player.pitch = pitch;
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      g.player._sync(0); g.camera.updateMatrixWorld(true);
    };

    // 1. throw into the cradle from the reachable bank
    seat(-14.35, -3, -0.045, -0.02);
    g.skull.holdNow();
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.55, { throwHeld: true }, false);
    const anchored = { mode: g.skull.mode, puzzleId: g.skull.anchor?.puzzleId ?? null };

    // 2. hold, and walk west across the bridge while the gate is up
    let payout = 0;
    while (!route.gateOpen && payout < 600) { F.stepWith(1 / 120, { throwHeld: true }, false); payout++; }
    const atGateOpen = { progress: route.progress, gateOpen: route.gateOpen };
    let cross = 0;
    while (g.player.pos.x > -15.6 && cross < 900) { F.stepWith(1 / 120, { moveX: -1, run: true, throwHeld: true }, false); cross++; }
    const midCrossing = { x: +g.player.pos.x.toFixed(2), progress: +route.progress.toFixed(3) };

    // 3. HIS INPUT: let go here — a third of a metre short of the far bank —
    // and keep walking. progress rewinds at 0.34/s while the legs finish it.
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    let walk = 0;
    let progressAtFirstLanding = null;
    while (g.player.pos.x > -17.9 && walk < 900) {
      // sample BEFORE the step: latchRoute() sets progress = 1 in the same
      // frame it fires, so reading after the tick reads the latch, not the run-up
      const before = route.progress;
      F.stepWith(1 / 120, { moveX: -1 }, false);       // WALKING, not running
      if (progressAtFirstLanding === null && g.player.pos.x < -17.28) progressAtFirstLanding = before;
      walk++;
    }
    F.stepWith(0.5, {}, false);
    const arrived = {
      player: g.player.pos.toArray(),
      progress: route.progress,
      latched: route.latched,
      flag: g.flags.has('pumpGalleryLatched'),
      gateOpen: route.gateOpen,
      walkFrames: walk, midCrossing, progressAtFirstLanding,
      oldRuleWouldLatch: progressAtFirstLanding > 0.9,
    };

    // 4. floor census for the vermin: where is there real ground at B?
    const B = -3.0;
    const floor = [];
    for (let x = -21; x <= -12.5; x += 0.5) {
      const row = [];
      for (let z = -10.5; z <= 6.5; z += 0.5) {
        const h = g.world.groundHeightAt(x, z, B + 1.2);
        row.push(Math.abs(h - B) < 0.2 ? 1 : 0);
      }
      floor.push({ x: +x.toFixed(2), row: row.join('') });
    }
    return { anchored, atGateOpen, arrived, floor, zFrom: -10.5, zStep: 0.5 };
  });

  console.log('anchored   ', JSON.stringify(out.anchored));
  console.log('at gate open', JSON.stringify(out.atGateOpen));
  console.log('ARRIVED    ', JSON.stringify(out.arrived));
  console.log('\nfloor at B (z from -10.5 by 0.5, 1 = real ground):');
  for (const r of out.floor) console.log(String(r.x).padStart(7), r.row);
} finally {
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  server.stop();
}

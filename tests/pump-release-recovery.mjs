// Focused regression for the pump bridge's worst recoverable misuse:
// release LMB while standing between the closing near gate and the far pawl.
// The test drives the ordinary Player + Skull input path throughout; it never
// calls a target callback or mutates the pump route's progress/latch state.
//
//   node tests/pump-release-recovery.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const report = {
  url: `${URL_BASE}/?test=1&mute=1`,
  checks: [],
  errors: [],
  diagnostics: {},
};
const failures = [];
const check = (passed, name, details = null) => {
  const row = { name, passed: !!passed, details };
  report.checks.push(row);
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name}${details == null ? '' : ` -- ${JSON.stringify(details)}`}`);
  if (!row.passed) failures.push(name);
};

const server = await ensureServer();
const browser = await launchBrowser();
let page;

try {
  const opened = await openPage(browser, report.url);
  page = opened.page;
  report.errors = opened.errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 },
  );

  const renderer = await page.evaluate(() => {
    const gl = window.__game.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
  });
  report.diagnostics.renderer = renderer;
  check(/D3D11/i.test(renderer), 'system Chrome uses the real D3D11 ANGLE path', renderer);

  const result = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const route = g.pumpGallery;
    F.start();
    F.teleport('basement');
    g.enemies.list.length = 0;

    const settlePlayer = (x, z, yaw, pitch = 0) => {
      g.player.pos.set(x, -3, z);
      g.player.yaw = yaw;
      g.player.pitch = pitch;
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);
      g.camera.updateMatrixWorld(true);
    };

    // Begin beside the closed gate and throw north into the real cradle. The
    // slight yaw offset aims from this reachable bank position to its center.
    settlePlayer(-14.35, -3, -0.045, -0.02);
    g.skull.holdNow();
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.55, { throwHeld: true }, false);
    const firstAnchor = {
      mode: g.skull.mode,
      puzzleId: g.skull.anchor?.puzzleId ?? null,
      progress: route.progress,
    };

    // Keep leaning west into the physical gate. As soon as payout lifts it,
    // ordinary strafe input carries the player onto the first bridge segment.
    // Stop before the far-side x threshold, so the pawl cannot have latched.
    let payoutFrames = 0;
    while (route.progress < 0.955 && payoutFrames < 360) {
      F.stepWith(1 / 120, { moveX: -1, throwHeld: true }, false);
      payoutFrames++;
    }
    let crossingFrames = 0;
    while (g.player.pos.x > -15.62 && crossingFrames < 120) {
      F.stepWith(1 / 120, { moveX: -1, throwHeld: true }, false);
      crossingFrames++;
    }
    const beforeRelease = {
      player: g.player.pos.toArray(),
      progress: route.progress,
      latched: route.latched,
      gateOpen: route.gateOpen,
      skullMode: g.skull.mode,
    };

    // This is the actual failure input. The pump ticker runs after the skull
    // begins its return, so this same frame changes a fully extended bridge
    // into a partially paid-out, rewinding bridge under the player's feet.
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    const atRelease = {
      player: g.player.pos.toArray(),
      progress: route.progress,
      state: route.state,
      latched: route.latched,
      gateOpen: route.gateOpen,
      skullMode: g.skull.mode,
    };

    // Let every segment retract and the gate close. The player must remain on
    // the authored shallow floor, alive and movable, while the ordinary recall
    // completes and the physical cradle becomes hittable again.
    F.stepWith(3.35, {}, false);
    const rewound = {
      player: g.player.pos.toArray(),
      floor: g.world.groundHeightAt(g.player.pos.x, g.player.pos.z, g.player.pos.y),
      progress: route.progress,
      state: route.state,
      latched: route.latched,
      gateOpen: route.gateOpen,
      targetEnabled: route.target.enabled,
      skullMode: g.skull.mode,
      dead: g.dead,
    };

    // Re-aim through the skull-pass gate using the normal look-input path.
    // yaw = atan2(-dx, -dz) for Player's forward=(-sin(yaw), -cos(yaw)).
    // The cradle is scene-rooted, so its local position is its world position.
    const dx = route.cradle.position.x - g.player.pos.x;
    const dz = route.cradle.position.z - g.player.pos.z;
    const retryYaw = Math.atan2(-dx, -dz);
    const retryPitch = -0.03;
    F.stepWith(1 / 120, {
      lookX: (g.player.yaw - retryYaw) / 0.0022,
      lookY: (g.player.pitch - retryPitch) / 0.0022,
    }, false);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.7, { throwHeld: true }, false);
    const retryAnchor = {
      mode: g.skull.mode,
      puzzleId: g.skull.anchor?.puzzleId ?? null,
      player: g.player.pos.toArray(),
      yaw: g.player.yaw,
      progress: route.progress,
    };

    // Turn west through the same input path, walk the remaining distance, and
    // keep LMB held until the far pawl reacts to the player's actual position.
    F.stepWith(1 / 120, {
      lookX: (g.player.yaw - Math.PI / 2) / 0.0022,
      throwHeld: true,
    }, false);
    F.stepWith(0.62, { moveZ: 1, run: true, throwHeld: true }, false);
    let latchFrames = 0;
    while (!route.latched && latchFrames < 360) {
      F.stepWith(1 / 120, { throwHeld: true }, false);
      latchFrames++;
    }
    const latched = {
      player: g.player.pos.toArray(),
      progress: route.progress,
      state: route.state,
      latched: route.latched,
      gateOpen: route.gateOpen,
      flag: g.flags.has('pumpGalleryLatched'),
    };

    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    F.stepWith(1.8, {}, false);
    const recalled = {
      skullMode: g.skull.mode,
      progress: route.progress,
      latched: route.latched,
      gateOpen: route.gateOpen,
      gateColliderY: [route.gateCollider.min.y, route.gateCollider.max.y],
    };

    // With the pawl down, use ordinary run input to return across the bridge,
    // through the former gate, and out the authored crawl-room doorway.
    F.stepWith(1 / 120, {
      lookX: (g.player.yaw + Math.PI / 2) / 0.0022,
    }, false);
    F.stepWith(2.05, { moveZ: 1, run: true }, false);
    const left = {
      player: g.player.pos.toArray(),
      floor: g.world.groundHeightAt(g.player.pos.x, g.player.pos.z, g.player.pos.y),
      dead: g.dead,
      movementLocked: g.player.movementLocked,
      routeState: route.state,
    };

    return {
      firstAnchor, payoutFrames, crossingFrames, beforeRelease, atRelease,
      rewound, retryAnchor, latchFrames, latched, recalled, left,
      browserErrors: [],
    };
  });
  report.diagnostics.route = result;

  check(result.firstAnchor.mode === 'anchored'
      && result.firstAnchor.puzzleId === 'pumpGallery',
  'reachable-bank throw physically anchors in the pump cradle', result.firstAnchor);
  check(result.beforeRelease.player[0] < -15.2
      && result.beforeRelease.player[0] > -17.28
      && !result.beforeRelease.latched
      && result.beforeRelease.gateOpen,
  'player input reaches the bridge interior without prematurely latching', result.beforeRelease);
  check(result.atRelease.progress > 0 && result.atRelease.progress < 1
      && result.atRelease.state === 'rewinding'
      && result.atRelease.skullMode === 'returning'
      && !result.atRelease.latched,
  'LMB release leaves a partially paid-out bridge rewinding under the mid-crossing player', result.atRelease);
  check(!result.rewound.dead
      && Math.abs(result.rewound.player[1] - result.rewound.floor) < 0.02
      && result.rewound.progress === 0
      && result.rewound.state === 'idle'
      && !result.rewound.gateOpen
      && result.rewound.targetEnabled
      && result.rewound.skullMode === 'held',
  'full rewind leaves the player alive on real floor and rearms the cradle', result.rewound);
  check(result.retryAnchor.mode === 'anchored'
      && result.retryAnchor.puzzleId === 'pumpGallery',
  'a real second throw reaches the rearmed cradle through the closed skull-pass gate', result.retryAnchor);
  check(result.latched.latched && result.latched.flag
      && result.latched.player[0] < -17.28
      && result.latched.progress === 1
      && result.latched.gateOpen,
  'continued hold plus player traversal drops the far-side pawl', result.latched);
  check(result.recalled.skullMode === 'held'
      && result.recalled.latched
      && result.recalled.progress === 1
      && result.recalled.gateOpen
      && result.recalled.gateColliderY[1] < -10,
  'release recalls the skull while the latched route stays physically open', result.recalled);
  check(!result.left.dead && !result.left.movementLocked
      && result.left.player[0] > -12.2
      && Math.abs(result.left.player[1] - result.left.floor) < 0.02,
  'ordinary run input leaves the pump district after recovery', result.left);
  check(report.errors.length === 0, 'focused recovery produces zero browser errors', report.errors.slice());
} catch (error) {
  const message = error?.stack || error?.message || String(error);
  failures.push('suite exception');
  report.exception = message;
  console.error(message);
} finally {
  report.pass = failures.length === 0;
  writeFileSync(resultsPath('pump-release-recovery.json'), JSON.stringify(report, null, 2));
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  server.stop();
}

console.log(report.pass ? '\nALL PASS' : `\n${failures.length} FAILURE(S): ${failures.join(' | ')}`);
process.exit(report.pass ? 0 : 1);

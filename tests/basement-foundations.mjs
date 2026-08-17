// Focused deterministic coverage for the authored cellar flight and the
// optional crawl-wing counterweight. This complements the full playthrough:
//   node tests/basement-foundations.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    F.start();
    F.teleport('basement');
    F.stepWith(1 / 120, {}, false);

    const stair = g.world.rampById.cellarStairs;
    check(
      'cellar flight compiles as tagged thin open-under treads',
      stair?.openUnder === true
        && stair.treadCount === 11
        && stair.treadColliders.length === 11
        && stair.treadColliders.every((c, i) => c.stairId === 'cellarStairs'
          && c.stairPart === 'tread' && c.stairStep === i),
      stair && {
        openUnder: stair.openUnder,
        treadCount: stair.treadCount,
        treadColliders: stair.treadColliders.length,
      },
    );
    check(
      'cellar flight guards the drop while leaving its authored basement side landing open',
      stair?.edgeColliders.length === (stair?.treadCount - stair?.edgeOpenAtEnd) * 2
        && stair.edgeColliders.every((c) => c.stairPart === 'edge'),
      { edgeColliders: stair?.edgeColliders.length, edgeOpenAtEnd: stair?.edgeOpenAtEnd },
    );
    const returnFlight = g.world.rampById.cellarReturn;
    check(
      'side landing continues onto a westbound return flight instead of a fall',
      returnFlight?.axis === 'x'
        && Math.abs(g.world.groundHeightAt(7.9, 4.5, -1.8) - -2.025) < 0.08
        && Math.abs(g.world.groundHeightAt(4.1, 4.5, -1.8) - -2.975) < 0.08,
      {
        axis: returnFlight?.axis,
        landingY: g.world.groundHeightAt(7.9, 4.5, -1.8),
        basementY: g.world.groundHeightAt(4.1, 4.5, -1.8),
      },
    );

    const P = g.player;
    P.pos.set(7.5, -3, 2.14); P.vel.set(0, 0, 0); P.grounded = true;
    for (let i = 0; i < 40; i++) P._moveAxis(0.025, 0);
    const highEndX = P.pos.x;
    P.pos.set(7.5, -3, 3.72); P.vel.set(0, 0, 0); P.grounded = true;
    for (let i = 0; i < 40; i++) P._moveAxis(0.025, 0);
    const lowEndX = P.pos.x;
    P.pos.set(9, -2, 4.32); P.vel.set(0, 0, 0); P.grounded = true;
    for (let i = 0; i < 60; i++) P._moveAxis(-0.025, 0);
    const landingExitX = P.pos.x;
    check(
      'real under-stair corridor and basement side landing remain open while low-headroom side entry is solid',
      highEndX > 8.3 && lowEndX < 8 && landingExitX < 7.8,
      { highEndX, lowEndX, landingExitX },
    );

    const puzzle = g.crawlSecret;
    const target = g.world.fetchTargets.find((t) => t.id === 'crawlCounterweightCradle');
    check(
      'crawl secret exposes stable authored state and skull-pass cage collision',
      puzzle?.id === 'crawlCounterweight'
        && puzzle.target === target
        && puzzle.colliders.length === 2
        && puzzle.colliders.every((c) => c.skullPass && c.secretId === 'crawlCounterweight'),
      {
        id: puzzle?.id,
        target: target?.id,
        cageColliders: puzzle?.colliders.map((c) => ({ id: c.id, skullPass: c.skullPass })),
      },
    );

    if (target && puzzle) {
      const targetPos = target.object.getWorldPosition(g.player.pos.clone());
      F.setSkull(targetPos.x, targetPos.y, targetPos.z, 0, 0, 0, 'outbound');
      const shortDirective = target.onHit.call(target, g.skull);
      F.stepWith(0.3, { throwHeld: true }, false);
      F.stepWith(0.05, { throwHeld: false }, false);
      g.skull.holdNow();
      F.stepWith(0.8, {}, false);
      check(
        'an early release resets instead of consuming or solving the secret',
        shortDirective === 'anchor'
          && !puzzle.solved
          && puzzle.state === 'idle'
          && puzzle.progress === 0
          && target.enabled,
        {
          shortDirective, solved: puzzle.solved, state: puzzle.state,
          progress: puzzle.progress, targetEnabled: target.enabled,
        },
      );

      const retryPos = target.object.getWorldPosition(g.player.pos.clone());
      F.setSkull(retryPos.x, retryPos.y, retryPos.z, 0, 0, 0, 'outbound');
      const heldDirective = target.onHit.call(target, g.skull);
      F.stepWith(1.4, { throwHeld: true }, false);
      check(
        'holding the thrown skull weighs, lifts, and permanently latches the pump-works drive weight',
        heldDirective === 'anchor'
          && puzzle.solved
          && puzzle.state === 'latched'
          && puzzle.progress === 1
          && !target.enabled
          && g.flags.has('crawlSecretSolved')
          && puzzle.shutter.position.y > -0.1,
        {
          heldDirective, solved: puzzle.solved, state: puzzle.state,
          progress: puzzle.progress, targetEnabled: target.enabled,
          shutterY: puzzle.shutter.position.y,
          flags: [...g.flags].filter((f) => f.startsWith('crawl')),
        },
      );
      F.stepWith(0.05, { throwHeld: false }, false);
      F.stepWith(2.5, {}, false);
      check(
        'release after the latch returns the skull without closing the reveal',
        g.skull.mode === 'held'
          && puzzle.solved
          && puzzle.progress === 1
          && puzzle.lamp.intensity > 10,
        { skullMode: g.skull.mode, solved: puzzle.solved, lampIntensity: puzzle.lamp.intensity },
      );
    }

    return checks;
  });

  for (const c of report.checks) {
    console.log(`  ${c.passed ? 'PASS' : 'FAIL'} ${c.name}`
      + (c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`));
    if (!c.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(`  browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
  writeFileSync(resultsPath('basement-foundations.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);

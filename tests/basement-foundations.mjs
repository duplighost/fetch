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

      const deathPos = target.object.getWorldPosition(g.player.pos.clone());
      F.setSkull(deathPos.x, deathPos.y, deathPos.z, 0, 0, 0, 'outbound');
      const deathDirective = target.onHit.call(target, g.skull);
      F.stepWith(0.58, { throwHeld: true }, false);
      const partialBeforeDeath = puzzle.progress;
      g.director.death(null);
      F.stepWith(1.55, { throwHeld: true }, false);
      const heldDeath = {
        solved: puzzle.solved, state: puzzle.state, progress: puzzle.progress,
        flag: g.flags.has('crawlSecretSolved'), targetEnabled: target.enabled,
        skullMode: g.skull.mode,
      };
      g.director.respawn();
      F.stepWith(0.25, {}, false);
      const afterDeathRespawn = {
        solved: puzzle.solved, state: puzzle.state, progress: puzzle.progress,
        flag: g.flags.has('crawlSecretSolved'), targetEnabled: target.enabled,
        skullMode: g.skull.mode, act: g.act,
      };
      check(
        'death while the optional counterweight remains physically held cannot ghost-solve it',
        deathDirective === 'anchor'
          && partialBeforeDeath > 0 && partialBeforeDeath < 1
          && !heldDeath.solved && heldDeath.progress === 0 && !heldDeath.flag
          // Death must break the anchor immediately. Over this deliberately
          // long dead-life sample, the ordinary return may also finish its
          // physical catch; neither returning nor held can keep weighing.
          && ['returning', 'held'].includes(heldDeath.skullMode)
          && !afterDeathRespawn.solved && afterDeathRespawn.progress === 0
          && !afterDeathRespawn.flag && afterDeathRespawn.targetEnabled
          && afterDeathRespawn.skullMode === 'held' && afterDeathRespawn.act === 'basement',
        { deathDirective, partialBeforeDeath, heldDeath, afterDeathRespawn },
      );

      const retryPos = target.object.getWorldPosition(g.player.pos.clone());
      F.setSkull(retryPos.x, retryPos.y, retryPos.z, 0, 0, 0, 'outbound');
      const heldDirective = target.onHit.call(target, g.skull);
      F.stepWith(1.4, { throwHeld: true }, false);
      check(
        'holding the thrown skull weighs, lifts, and permanently latches the optional reveal',
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
      const revealAtDeath = {
        t: puzzle.revealT,
        ballZ: puzzle.ball.position.z,
        punctuated: g.flags.has('crawlSecretPunctuated'),
      };
      g.director.death(null);
      F.stepWith(1.35, { throwHeld: true }, false);
      const revealWhileDead = {
        t: puzzle.revealT,
        ballZ: puzzle.ball.position.z,
        punctuated: g.flags.has('crawlSecretPunctuated'),
        skullMode: g.skull.mode,
      };
      g.director.respawn();
      F.stepWith(0.12, {}, false);
      const revealAfterRespawn = puzzle.revealT;
      F.stepWith(1.25, {}, false);
      const revealCompleted = {
        t: puzzle.revealT,
        ballZ: puzzle.ball.position.z,
        punctuated: g.flags.has('crawlSecretPunctuated'),
        ballKnocked: !!puzzle.ballKnocked,
        knockPlayed: puzzle.revealKnock,
        whisperPlayed: puzzle.revealWhisper,
      };
      check(
        'death pauses the solved kennel tableau so the living re-entry receives its ball, knock and whisper',
        revealAtDeath.t > 0 && revealAtDeath.t < 0.5 && !revealAtDeath.punctuated
          && Math.abs(revealWhileDead.t - revealAtDeath.t) < 1e-6
          && Math.abs(revealWhileDead.ballZ - revealAtDeath.ballZ) < 1e-6
          && !revealWhileDead.punctuated && revealWhileDead.skullMode !== 'anchored'
          && revealAfterRespawn > revealAtDeath.t
          && revealCompleted.t > 1.15 && revealCompleted.ballZ > 1.2
          && revealCompleted.punctuated && revealCompleted.ballKnocked
          && revealCompleted.knockPlayed && revealCompleted.whisperPlayed,
        { revealAtDeath, revealWhileDead, revealAfterRespawn, revealCompleted },
      );
      F.stepWith(1.2, {}, false);
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

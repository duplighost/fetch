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

    // THE PAWL IS A FLOOR PLATE. Alex: "slightly slide the spikey thing in the
    // basement that locks the gate into place so its at the end of the walkway
    // and either make it less veryically tall, or put it in the floor so the
    // player walks over it automatically." It used to stand 0.69 m tall, 1.66 m
    // north of the crossing lane behind the channel rail — so the object that
    // locked the gate was not the object you touched. Pin the new shape, or the
    // next refactor stands it back up and nobody notices.
    {
      const pawl = g.scene.getObjectByName('pump-gallery-far-pawl');
      // highest world y any part of it reaches — walked, not climbed
      let topY = -Infinity;
      pawl?.traverse((o) => {
        if (!o.isMesh) return;
        o.updateWorldMatrix(true, false);
        const h = (o.geometry.parameters?.height ?? 0) / 2;
        topY = Math.max(topY, o.getWorldPosition(g.player.pos.clone()).y + h);
      });
      const box = topY > -Infinity ? { max: { y: topY } } : null;
      check(
        'the far pawl is a flush plate at the end of the walkway, on the crossing lane',
        !!pawl
          && Math.abs(pawl.position.z - (-3)) < 0.25          // the crossing centreline
          && pawl.position.x < -17.4 && pawl.position.x > -18.1  // the deck's west end
          && !!box && box.max.y < -2.85                       // under B+0.15: never a wall
          // and it still owns no collider of its own — the player walks over it
          && !g.world.colliders.some((c) => c.min.x < -17.3 && c.max.x > -18.1
            && c.min.z < -2.5 && c.max.z > -3.5
            && c.max.y > -2.95 && c.min.y < -2.5),
        { pos: pawl ? pawl.position.toArray().map((v) => +v.toFixed(2)) : null,
          topY: box ? +box.max.y.toFixed(3) : null },
      );
      // ...and the throw affordance survived the drop: the catch sphere is a
      // fixed knee-to-waist point now, not the sunken group's own origin.
      const pawlTarget = g.world.fetchTargets.find((t) => t.id === 'pumpFarPawl');
      check(
        'a thrown skull can still find the pawl after it sank into the floor',
        !!pawlTarget && !pawlTarget.object && !!pawlTarget.pos
          && pawlTarget.pos.y > -2.7 && pawlTarget.pos.y < -2.2,
        { pos: pawlTarget?.pos ? pawlTarget.pos.toArray().map((v) => +v.toFixed(2)) : null,
          hasObject: !!pawlTarget?.object },
      );
    }

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

    // THE SECOND STALL, AND THE THING IN IT, GOES NOWHERE.
    //
    // Four properties that must never drift: the pen's world position is
    // byte-identical to its authored home after thirty seconds of stepping with
    // the player stood at the bars; the body's local excursion stays inside the
    // constructed bound; nothing in the cell is ever registered as an enemy;
    // and both cell colliders exist and are skullPass, so no new enemy
    // line-of-sight blocker was introduced into the room the playthrough fights
    // walkers in twice.
    //
    // The excursion bound ALONE would not catch a body rotated the wrong way --
    // it would sit a metre outside the bars and still report a tiny excursion --
    // so the body's world envelope is asserted as well. Every number here is
    // floored under the construction maxima derived by
    //   node tools/probe-cell-two-containment.mjs
    // which sweeps the real ticker over the entire [-1,1] cube steppedJerk can
    // return: body x -7.135..-4.580, y -2.980.., z -9.446..-8.458.
    {
      const cell = g.cellTwo;
      const home = cell?.home?.clone();
      const wasEnemy = !!cell && g.enemies.list.some((e) =>
        e.mesh === cell.pen || e.mesh === cell.occupant || e.mesh === cell.stall);
      g.player.pos.set(-5.6, -3, -6.6);
      g.player.yaw = 0.54;                 // yaw 0 is -z, so PI would face AWAY
      g.player.pitch = 0;
      g.player._sync(0);
      const o = cell?.occupant;
      if (o && !o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const verts = o ? o.geometry.attributes.position.array : new Float32Array(0);
      const vertCount = o ? o.geometry.attributes.position.count : 0;
      const env = { minX: Infinity, maxX: -Infinity, minY: Infinity, minZ: Infinity, maxZ: -Infinity };
      let worst = 0;
      for (let i = 0; i < 300; i++) {
        // Nothing may interrupt thirty seconds of standing still at the bars.
        g.enemies.list.length = 0;
        F.stepWith(0.1, {}, false);
        if (!o) break;
        worst = Math.max(worst, cell.occupant.position.length());
        o.updateWorldMatrix(true, false);
        const e = o.matrixWorld.elements;
        for (let v = 0; v < vertCount; v++) {
          const x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
          const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
          const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
          const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (wx < env.minX) env.minX = wx;
          if (wx > env.maxX) env.maxX = wx;
          if (wy < env.minY) env.minY = wy;
          if (wz < env.minZ) env.minZ = wz;
          if (wz > env.maxZ) env.maxZ = wz;
        }
      }
      const cellColliders = g.world.colliders.filter((c) =>
        c.id === 'crawlCellTwoFront' || c.id === 'crawlCellTwoSide');
      const barTarget = g.world.fetchTargets.find((t) => t.id === 'crawlCellTwoBars');
      // 'continue' and nothing else: the bars are a wall with a thing behind
      // them, not a fetch target, and the throw grammar stays untouched.
      const barDirective = barTarget ? barTarget.onHit(g.skull) : null;
      check(
        'the caged thing shakes its bars, is never an enemy, and never leaves the cell',
        !!cell && !!home && cell.pen.position.distanceTo(home) === 0
          && worst > 0.001 && worst <= 0.116
          && !wasEnemy
          && !g.dead
          && env.minX < -6.95                                  // it DOES reach through the iron
          && env.minX >= -7.14 && env.maxX <= -4.20            // ...and no further, either way
          && env.minZ >= -9.80 && env.maxZ <= -7.55
          && env.minY >= -3.00
          && cellColliders.length === 2
          && cellColliders.every((c) => c.skullPass)
          && barDirective === 'continue',
        {
          home: home?.toArray().map((v) => +v.toFixed(3)),
          pen: cell?.pen.position.toArray().map((v) => +v.toFixed(3)),
          worstExcursion: +worst.toFixed(4),
          envelope: [env.minX, env.maxX, env.minY, env.minZ, env.maxZ].map((v) => +v.toFixed(3)),
          wasEnemy, dead: g.dead, barDirective,
          colliders: cellColliders.map((c) => ({ id: c.id, skullPass: c.skullPass })),
        },
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

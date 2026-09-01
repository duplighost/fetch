// Round Eighteen's narrow ownership/lifecycle contract:
//   node tests/horror-polish-round18-regression.mjs
// This is intentionally cheaper than the full playthrough. It proves the new
// scares are lazy, reset-safe and progression-neutral before the broad gates.
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
const report = {
  url: `${URL_BASE}/?test=1&mute=1`,
  checks: [],
  browserErrors: [],
};
let exit = 0;

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true
      && window.__game?.frontDoorKnock
      && window.__game?.wreck
      && window.__game?.forest?.storyProps
      && window.__game?.underfalls?.dread,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
    const pose = (x, y, z) => {
      g.player.pos.set(x, y, z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.frozen = false;
      g.player.movementLocked = false;
      g.player._sync(0);
    };

    const bootHiders = g.forest.storyProps.filter((prop) => prop.hider);
    check(
      'all scenery hiders and the wreck passenger are absent at boot',
      bootHiders.length === 2
        && bootHiders.every((prop) => prop.hider.phase === 'armed' && !prop.hider.actor)
        && !g.wreck.passenger.actor,
      {
        hiders: bootHiders.map((prop) => ({ id: prop.id, phase: prop.hider.phase, actor: !!prop.hider.actor })),
        passenger: !!g.wreck.passenger.actor,
      },
    );

    F.start();
    g.director.scareT = 9999;

    // Returning upstairs never rewinds the monotonic act clock from basement.
    // Three new knocks must nevertheless receive one physical answer.
    F.teleport('basement');
    g.flag('ateFlame');
    g.enemies.clear();
    g.director.resident = null;
    pose(4.2, 0, -8.1);
    const knock = g.frontDoorKnock;
    const coat = g.houseReturnProps.foyerCoatStand;
    const coatBefore = coat.rotation.z;
    knock.onKnock();
    F.stepWith(0.32, {}, false);
    knock.onKnock();
    F.stepWith(0.32, {}, false);
    knock.onKnock();
    const answerStarted = knock.answering;
    F.stepWith(1.55, {}, false);
    const residents = g.enemies.list.filter((enemy) => enemy.kind === 'resident');
    check(
      'the post-basement front door answers upstairs without rewinding progression',
      answerStarted === 'returnAnswer'
        && knock.returnDone
        && g.flags.has('frontDoorReturnAnswer')
        && g.act === 'basement'
        && coat.rotation.z - coatBefore > 0.35
        && residents.length === 1
        && residents[0].graveRiseT === 0
        && Math.abs(residents[0].mesh.scale.y - residents[0].spec.scale) < 0.001
        && !g.player.frozen
        && !g.player.movementLocked,
      {
        answerStarted,
        returnDone: knock.returnDone,
        act: g.act,
        coatFall: round(knock.coatFall),
        coatRotationDelta: round(coat.rotation.z - coatBefore),
        residents: residents.length,
        residentRise: residents[0]?.graveRiseT,
        residentScaleY: round(residents[0]?.mesh.scale.y),
        frozen: g.player.frozen,
        movementLocked: g.player.movementLocked,
      },
    );

    // The body does not exist until impact two. A bare list clear is a normal
    // ownership boundary in FETCH and must rebuild the unspent reveal.
    F.teleport('graveyard');
    g.enemies.clear();
    g.director.resident = null;
    g.wreck.reset();
    const wagon = g.world.fetchTargets.find((target) => target.id === 'wreckedWagon');
    const outbound = { mode: 'outbound' };
    const impact = wagon.pos.clone();
    wagon.onHit.call(wagon, outbound, impact);
    const absentAfterOne = !g.wreck.passenger.actor;
    wagon.onHit.call(wagon, outbound, impact);
    const firstPassenger = g.wreck.passenger.actor;
    if (firstPassenger) g.enemies.clear((enemy) => enemy === firstPassenger);
    g.wreck.passenger.update(1 / 60);
    g.wreck.passenger.update(1 / 60);
    const rebuiltPassenger = g.wreck.passenger.actor;
    check(
      'the wreck passenger is lazy and reconstructs after an unspent enemy clear',
      absentAfterOne
        && !!firstPassenger
        && !!rebuiltPassenger
        && rebuiltPassenger !== firstPassenger
        && rebuiltPassenger.wreckPassenger === true,
      {
        absentAfterOne,
        first: !!firstPassenger,
        rebuilt: !!rebuiltPassenger,
        distinct: rebuiltPassenger !== firstPassenger,
        hits: g.wreck.hits,
      },
    );
    F.stepWith(1.0, {}, false);
    const passengerDistance = rebuiltPassenger
      ? Math.hypot(rebuiltPassenger.pos.x - impact.x, rebuiltPassenger.pos.z - impact.z)
      : 0;
    if (rebuiltPassenger) {
      // End this isolated reveal as a real defeated body before waiting on the
      // relic arc; otherwise the regression becomes an accidental combat test.
      rebuiltPassenger.state = 'dying';
      g.enemies.clear((enemy) => enemy === rebuiltPassenger);
      g.wreck.passenger.update(1 / 60);
    }
    wagon.onHit.call(wagon, outbound, impact);
    wagon.onHit.call(wagon, outbound, impact);
    const relic = g.graveyardCarRelic;
    F.stepWith(1.34, {}, false);
    F.stepWith(0.96, {}, false);
    const carBox = g.wreck.collider;
    const landOutsideCar = relic.home.x < carBox.min.x - 0.34
      || relic.home.x > carBox.max.x + 0.34
      || relic.home.z < carBox.min.z - 0.34
      || relic.home.z > carBox.max.z + 0.34;
    const ironCanine = g.world.fetchTargets.find((target) => target.id === 'ironCanine');
    check(
      'four car hits eject the keepsake onto visible reachable ground while the Iron Canine stays at its grave',
      passengerDistance > 1.75
        && g.wreck.dead
        && g.flags.has('wreckDestroyed')
        && g.flags.has('wreckRelicEjected')
        && g.flags.has('wreckRelicLanded')
        && relic.phase === 'settled'
        && relic.mesh.visible
        && relic.target.enabled
        && landOutsideCar
        && relic.start.distanceTo(g.wreck.relicLaunch) < 0.001
        && relic.home.distanceTo(g.wreck.relicLand) < 0.001
        && !!ironCanine
        && ironCanine !== relic.target
        && !g.flags.has('relicKept'),
      {
        passengerDistance: round(passengerDistance),
        hits: g.wreck.hits,
        phase: relic.phase,
        visible: relic.mesh.visible,
        enabled: relic.target.enabled,
        landOutsideCar,
        startError: round(relic.start.distanceTo(g.wreck.relicLaunch)),
        homeError: round(relic.home.distanceTo(g.wreck.relicLand)),
        ironCanine: !!ironCanine,
      },
    );

    // Appliance bodies obey the same lazy ownership rule. The route updater,
    // not a boot spawn, re-arms an unspent clear.
    F.teleport('forest');
    g.enemies.clear();
    const hiderProp = bootHiders[0];
    const firstHider = hiderProp.hider.trigger();
    if (firstHider) g.enemies.clear((enemy) => enemy === firstHider);
    g.forest._updateForestStoryProps(1 / 60);
    const rearmed = hiderProp.hider.phase === 'armed' && !hiderProp.hider.actor;
    const secondHider = hiderProp.hider.trigger();
    F.stepWith(0.94, {}, false);
    const optionalReads = g.forest.optionalRopes.map((line) => {
      const knot = line.target.object;
      const candle = g.world.candles.find((candidate) =>
        Math.hypot(candidate.x - line.pivot.x, candidate.z - line.pivot.z) < 0.05
          && Math.abs(candidate.y - (line.pivot.y - 0.25)) < 0.05);
      return {
        id: line.id,
        emissive: knot?.material?.emissiveIntensity || 0,
        candle: candle ? { intensity: candle.intensity, r: candle.r } : null,
      };
    });
    check(
      'forest appliance reveals are reset-safe and every optional swing point carries a bright physical read',
      !!firstHider
        && rearmed
        && !!secondHider
        && secondHider !== firstHider
        && secondHider.state === 'wind'
        && !secondHider.riseFrozen
        && g.forest.optionalRopes.length === 2
        && optionalReads.every((read) => read.emissive >= 1.8
          && read.candle?.intensity >= 0.7 && read.candle?.r >= 4.5)
        && g.ambientTarget >= 0.6,
      {
        prop: hiderProp.id,
        rearmed,
        state: secondHider?.state,
        riseFrozen: secondHider?.riseFrozen,
        ambientTarget: g.ambientTarget,
        optionalReads,
      },
    );

    // The new branch participates in the same route union and the two Witness
    // figures are explicitly scenery: no collider, enemy or damage ownership.
    const U = g.underfalls;
    const L = U.layout;
    const allBlindInside = L.blind.every((point) => point.x >= g.caveZone.min.x
      && point.x <= g.caveZone.max.x
      && point.z >= g.caveZone.min.z
      && point.z <= g.caveZone.max.z);
    check(
      'Underfalls owns a longer required bend plus a real analytic dead arm',
      L.mainLength > 130
        && L.blindLength > 18
        && L.blind.length === 3
        && L.blindSegments.length === 2
        && L.segments.includes(L.blindSegments[0])
        && allBlindInside,
      {
        mainLength: round(L.mainLength),
        blindLength: round(L.blindLength),
        blindNodes: L.blind.length,
        allBlindInside,
      },
    );
    g.flag('waterfallTaken');
    F.teleport('cave');
    const H = L.hatch;
    pose(H.x, U.groundAt(H.x, H.z + 2.15), H.z + 2.15);
    const enemyCountBeforeWitness = g.enemies.list.length;
    F.stepWith(0.12, {}, false);
    const witnessInEnemies = g.enemies.list.some((enemy) =>
      enemy.mesh === U.dread.guardian || enemy.mesh === U.dread.blindWitness);
    check(
      'the hatch Witness produces close-range horror without damage, collision or control theft',
      U.dread.harmless
        && U.dread.approachTriggered
        && U.dread.closeTriggered
        && g.flags.has('underfallsWitnessApproached')
        && g.flags.has('underfallsWitnessReached')
        && Math.abs(U.dread.witnessPresence.group.position.y) < 0.001
        && !witnessInEnemies
        && !g.dead
        && !g.player.frozen
        && !g.player.movementLocked
        && g.act === 'cave',
      {
        harmless: U.dread.harmless,
        approach: U.dread.approachTriggered,
        close: U.dread.closeTriggered,
        witnessLocalY: round(U.dread.witnessPresence.group.position.y),
        witnessInEnemies,
        enemyCountBeforeWitness,
        enemyCountAfterWitness: g.enemies.list.length,
        liveEnemyKinds: g.enemies.list.map((enemy) => enemy.kind),
        dead: g.dead,
        frozen: g.player.frozen,
        movementLocked: g.player.movementLocked,
        act: g.act,
      },
    );

    return checks;
  });

  for (const check of report.checks) {
    console.log(`  ${check.passed ? 'PASS' : 'FAIL'} ${check.name}`
      + (check.details == null ? '' : ` -- ${JSON.stringify(check.details)}`));
    if (!check.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(`  browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  writeFileSync(resultsPath('horror-polish-round18-regression.json'), JSON.stringify(report, null, 2));
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);

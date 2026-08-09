// Focused deterministic contract for the skull-less cave encounter:
//   node tests/horror-expansion.mjs
// Real GPU/browser. It first samples the production WebAudio panners, then uses
// method spies for the long deterministic lifecycle so audio timing cannot make
// the gameplay assertions flaky.
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  // Retain the live page-error array; the encounter continues long after boot.
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
    const events = [];
    const loops = [];
    const posOf = (p) => p && [p.x, p.y, p.z].map((n) => +Number(n).toFixed(3));

    // Prove the production loop creates actual HRTF PannerNodes before replacing
    // its long-running surface with deterministic lifecycle spies.
    F.start();
    const nativePannerModels = [];
    const originalPanner = g.audio._panner;
    g.audio._panner = function (...args) {
      const node = originalPanner.apply(this, args);
      nativePannerModels.push(node.panningModel);
      return node;
    };
    const nativeLoop = g.audio.drownedChoirLoop({ x: 2, y: 1.4, z: 5 });
    g.audio._panner = originalPanner;
    nativeLoop.stop();
    check(
      'the production Choir loop owns two real HRTF spatial sources',
      g.audio._ready && nativePannerModels.length === 2
        && nativePannerModels.every((model) => model === 'HRTF'),
      { audioReady: g.audio._ready, pannerModels: nativePannerModels },
    );

    // Replace only the encounter's new audio surface with deterministic spies;
    // all gameplay still advances through the production Director/Enemies code.
    for (const name of ['caveDrip', 'drownedCall', 'drownedSurge', 'sprayReveal', 'drownedImpact']) {
      g.audio[name] = (opts = {}) => {
        events.push({ name, pos: posOf(opts.pos), gain: opts.gain ?? null, at: +g.time.toFixed(3) });
        return !!opts.pos;
      };
    }
    g.audio.drownedChoirLoop = (pos) => {
      const loop = {
        start: posOf(pos), stopped: false, positions: [], states: [], douses: [],
        setPos(x, y, z) { this.positions.push([x, y, z]); },
        setState(...state) { this.states.push(state); },
        douse(x) { this.douses.push(x); },
        stop() { this.stopped = true; },
      };
      loops.push(loop);
      return loop;
    };

    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('cave');
    F.stepWith(1 / 120, {}, false);

    const prelude = g.director._caveEcology;
    const introCall = events.find((e) => e.name === 'drownedCall');
    check(
      'cave entry begins with positioned enemy audio but preserves the passive false sighting',
      !g.enemies.choir
        && !!introCall?.pos
        && !!g.underfalls?.displacement
        && !g.underfalls.displacement.revealed,
      {
        introCall,
        choirCount: g.enemies.list.filter((e) => e.kind === 'choir').length,
        passiveHeard: g.underfalls?.displacement?.heard,
        passiveRevealed: g.underfalls?.displacement?.revealed,
      },
    );
    check(
      'the skull stays gone and the cave owns a local respawn checkpoint',
      g.skull.mode === 'gone' && g.lastCheckpoint === 'cave' && g.checkpointPose?.act === 'cave',
      { skull: g.skull.mode, checkpoint: g.lastCheckpoint, pose: g.checkpointPose },
    );

    const chapelApproach = g.underfalls.layout.main[4];
    g.player.pos.set(chapelApproach.x, chapelApproach.y, chapelApproach.z);
    g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true; g.player._sync(0);
    F.stepWith(1.0, {}, false);
    check(
      'the chapel displacement is visibly first and remains non-attacking',
      g.underfalls.displacement.revealed
        && g.underfalls.displacement.root.visible
        && !g.enemies.choir
        && !g.dead,
      {
        passiveHeard: g.underfalls.displacement.heard,
        passiveRevealed: g.underfalls.displacement.revealed,
        passiveVisible: g.underfalls.displacement.root.visible,
        choirCount: g.enemies.list.filter((e) => e.kind === 'choir').length,
      },
    );

    const lowerSluice = g.underfalls.layout.lowerSluice;
    g.player.pos.set(lowerSluice.x, lowerSluice.y, lowerSluice.z);
    g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true; g.player._sync(0);
    F.stepWith(0.05, {}, false);
    const first = g.enemies.choir;
    const U = first?.mesh.userData;
    check(
      'passing the false sighting creates one non-walker Choir and starts its owned loop',
      !!first
        && first.kind === 'choir'
        && first.state === 'warning'
        && g.enemies.list.filter((e) => e.kind === 'choir').length === 1
        && U?.drownedChoir === true
        && U.curtains.length === 3
        && U.mouths.length === 3
        && loops[0]?.start?.length === 3,
      {
        kind: first?.kind,
        state: first?.state,
        choirCount: g.enemies.list.filter((e) => e.kind === 'choir').length,
        curtains: U?.curtains.length,
        mouths: U?.mouths.length,
        loopStart: loops[0]?.start,
      },
    );

    F.stepWith(1.0, {}, false);
    check(
      'the real predator keeps its own full audio-only warning before pursuit',
      first.state === 'warning'
        && first.age < 2.65
        && U.wetMat.opacity < 0.02
        && !g.dead,
      { state: first.state, age: first.age, wetOpacity: U.wetMat.opacity },
    );

    F.stepWith(1.68, {}, false);
    check(
      'warning duration is monotonic and pursuit starts only after the authored tell',
      first.age >= 2.65
        && first.state === 'stalk'
        && events.some((e) => e.name === 'drownedSurge'),
      { age: first.age, state: first.state, stateT: first.stateT },
    );

    // Force only encounter geometry, never state-machine results: put the
    // already-live threat in reach, then evade its production fixed strike with
    // real movement input.
    first.pos.set(g.player.pos.x, g.player.pos.y, g.player.pos.z - 1.35);
    first.heardPos.copy(g.player.pos);
    first.wetT = 0;
    first.state = 'stalk';
    first.stateT = 0.3;
    F.stepWith(0.05, {}, false);
    const committed = first.strikePos.clone();
    const beforeRun = g.player.pos.clone();
    F.stepWith(1.12, { moveZ: 1, run: true }, false);
    const escapedDistance = g.player.pos.distanceTo(beforeRun);
    check(
      'a pressure strike commits to one point and real running input evades it',
      !g.dead
        && first.state === 'recover'
        && first.strikePos.distanceTo(committed) < 0.001
        && escapedDistance > 1.4
        && !g.player.frozen
        && !g.player.movementLocked,
      {
        state: first.state,
        escapedDistance,
        strikeDrift: first.strikePos.distanceTo(committed),
        frozen: g.player.frozen,
        movementLocked: g.player.movementLocked,
      },
    );

    // The first caught pressure wave is an embodied warning, not a touch kill.
    first.pos.set(g.player.pos.x, g.player.pos.y, g.player.pos.z - 1.2);
    first.heardPos.copy(g.player.pos);
    first.state = 'stalk'; first.stateT = 0.3; first.wetT = 0;
    F.stepWith(0.05, {}, false);
    F.stepWith(1.08, {}, false);
    check(
      'the first caught wave wounds and recoils but never kills',
      !g.dead
        && first.warned
        && first.state === 'recover'
        && events.some((e) => e.name === 'drownedImpact'),
      { dead: g.dead, warned: first.warned, state: first.state },
    );

    // A real spray volume cancels even a committed second strike and clears the
    // wound mark, proving the outside.js integration contract is defensive.
    first.state = 'pressure'; first.stateT = 0.42; first.warned = true;
    const sprayCaught = g.enemies.caveSpray(first.pos.clone(), 2.5, 1);
    check(
      'caveSpray reveals, repels, cancels commitment, and clears the strike mark',
      sprayCaught === 1
        && first.state === 'recoil'
        && !first.warned
        && first.revealT > 1
        && first.washV.length() > 2
        && loops[0].douses.length > 0,
      {
        caught: sprayCaught,
        state: first.state,
        warned: first.warned,
        revealT: first.revealT,
        washSpeed: first.washV.length(),
        douses: loops[0].douses,
      },
    );

    // The under-falls lane consumes the public hook as an edge-triggered world
    // volume. Prove the real ticker contract, not only a direct unit call.
    const authoredZone = g.underfalls.sprayZones[0];
    const authoredPulse = g.underfalls.sprayPulse[0];
    const sprayEventsBefore = events.filter((e) => e.name === 'sprayReveal').length;
    first.pos.set(
      authoredZone.pos.x,
      g.underfalls.groundAt(authoredZone.pos.x, authoredZone.pos.z),
      authoredZone.pos.z,
    );
    first.heardPos.copy(first.pos);
    first.state = 'pressure'; first.stateT = 0.5; first.warned = true;
    first.revealT = 0; first.wetT = 0; first.washV.set(0, 0, 0);
    authoredPulse.inside = false;
    authoredPulse.nextAt = 0;
    g.player.pos.set(authoredZone.pos.x, first.pos.y, authoredZone.pos.z);
    g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true; g.player._sync(0);
    F.stepWith(1 / 60, {}, false);
    check(
      'crossing an authored sluice zone fires one defensive spray pulse through the public hook',
      first.state === 'recoil'
        && !first.warned
        && first.revealT > 1
        && first.washV.length() > 2
        && authoredPulse.inside
        && events.filter((e) => e.name === 'sprayReveal').length === sprayEventsBefore + 1,
      {
        zone: authoredZone.name,
        state: first.state,
        warned: first.warned,
        revealT: first.revealT,
        washSpeed: first.washV.length(),
        pulseInside: authoredPulse.inside,
      },
    );

    g.director._voidCool = 0;
    const callAt = events.length;
    g.director.onVoidCall();
    const answer = events.slice(callAt).find((e) => e.name === 'drownedCall');
    check(
      'calling the absent skull gives the Choir the player sound and answers from its body',
      first.heardStrength > 1
        && first.heardPos.distanceTo(g.player.pos) < 0.001
        && !!answer?.pos
        && Math.hypot(answer.pos[0] - first.pos.x, answer.pos[2] - first.pos.z) < 0.01,
      { heardStrength: first.heardStrength, heardPos: posOf(first.heardPos), answer, choirPos: posOf(first.pos) },
    );

    // Keep it off the player while the deterministic wall ecology cycles.
    first.pos.set(g.player.pos.x + 20, g.player.pos.y, g.player.pos.z + 20);
    first.heardPos.copy(first.pos); first.state = 'stalk'; first.stateT = 0;
    F.stepWith(5.2, {}, false);
    const drips = events.filter((e) => e.name === 'caveDrip');
    const zone = g.caveZone;
    check(
      'cave ecology cycles across finite authored world points, never nowhere/global sounds',
      drips.length >= 2
        && drips.every((e) => e.pos?.every(Number.isFinite))
        && drips.every((e) => e.pos[0] >= zone.min.x && e.pos[0] <= zone.max.x
          && e.pos[2] >= zone.min.z && e.pos[2] <= zone.max.z)
        && new Set(drips.map((e) => `${e.pos[0]},${e.pos[2]}`)).size >= 2,
      { count: drips.length, positions: drips.map((e) => e.pos) },
    );

    // Death owns cleanup; respawn at the cave checkpoint creates exactly one
    // fresh source and does not restore the skull.
    const firstLoop = loops[0];
    g.director.death(first);
    const deathRemoved = !g.enemies.choir && firstLoop.stopped;
    g.director.respawn();
    F.stepWith(0.05, {}, false);
    const respawnPreludeClean = !g.enemies.choir;
    const retryTrigger = g.underfalls.layout.lowerSluice;
    g.player.pos.set(retryTrigger.x, retryTrigger.y, retryTrigger.z);
    g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true; g.player._sync(0);
    F.stepWith(0.05, {}, false);
    const reborn = g.enemies.choir;
    check(
      'death stops the old source and cave respawn creates one fresh lifecycle',
      deathRemoved
        && !g.dead
        && g.act === 'cave'
        && !!reborn
        && reborn !== first
        && g.enemies.list.filter((e) => e.kind === 'choir').length === 1
        && loops.length === 2
        && respawnPreludeClean
        && g.skull.mode === 'gone',
      {
        deathRemoved, dead: g.dead, act: g.act, loops: loops.length,
        respawnPreludeClean,
        choirCount: g.enemies.list.filter((e) => e.kind === 'choir').length,
        skull: g.skull.mode,
      },
    );

    let leaked = 0;
    g.director.after(0.2, () => { leaked++; });
    const secondLoop = loops[1];
    g.director.enterMirrorRoom();
    const hatchCleanup = !g.enemies.choir && secondLoop.stopped && !g.director._caveEcology;
    g.director.setAct('mirror', true);
    F.stepWith(0.3, {}, false);
    check(
      'hatch/act change stop the source immediately and cancel cave-scoped delayed beats',
      hatchCleanup && leaked === 0 && g.act === 'mirror',
      { hatchCleanup, leaked, act: g.act, secondLoopStopped: secondLoop.stopped },
    );

    const positioned = events.filter((e) =>
      ['caveDrip', 'drownedCall', 'drownedSurge', 'sprayReveal', 'drownedImpact'].includes(e.name));
    check(
      'every new one-shot observed by the lifecycle carries a finite world position',
      positioned.length > 0 && positioned.every((e) => e.pos?.length === 3 && e.pos.every(Number.isFinite)),
      { count: positioned.length, missing: positioned.filter((e) => !e.pos || !e.pos.every(Number.isFinite)) },
    );

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
  writeFileSync(resultsPath('horror-expansion.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);

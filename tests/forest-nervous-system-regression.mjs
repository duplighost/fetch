// Focused contract for the donor-corrected forest nervous system:
//   node tests/forest-nervous-system-regression.mjs
// Two genuine short braids share monotonic progress with the sealing spline,
// and eight fixed story objects compete for a hard two-source HRTF budget.
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1&warmup=1&warmupRace=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true
      && window.__game?.forest?.forks?.length === 2
      && window.__game?.forest?.storyProps?.length === 8,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(async () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
    const posOf = (p) => p && [p.x, p.y, p.z].map(round);
    let audioBakeMs = 0;
    const originalBake = g.audio._bake;
    g.audio._bake = function (...args) {
      const at = performance.now();
      const result = originalBake.apply(this, args);
      audioBakeMs = performance.now() - at;
      return result;
    };
    const startAt = performance.now();
    F.start();
    const synchronousStartMs = performance.now() - startAt;
    check(
      'synchronous Start stays below the cold audio-hitch ceiling',
      synchronousStartMs < 250,
      {
        synchronousStartMs: round(synchronousStartMs),
        audioBakeMs: round(audioBakeMs),
        forestStoryBakeMs: round(g.audio._storyBakeMs),
        ceilingMs: 250,
      },
    );
    const prewarmAt = performance.now();
    while (!g.audio._storyPrewarmReady && performance.now() - prewarmAt < 3500) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const firstStoryAt = performance.now();
    const firstStoryHandle = g.audio.forestStoryLoop('radio', g.forest.storyProps[0].targetPos, { gain: 0.05 });
    const firstStoryLoopMs = performance.now() - firstStoryAt;
    firstStoryHandle?.stop();
    check(
      'idle prewarm completes in bounded slices and first audible prop is hitch-free',
      g.audio._storyPrewarmReady
        && Object.keys(g.audio._forestStoryBufs).length === 8
        && g.audio._storyPrewarmMaxChunkMs < 50
        && firstStoryLoopMs < 12
        && !!firstStoryHandle,
      {
        ready: g.audio._storyPrewarmReady,
        buffers: Object.keys(g.audio._forestStoryBufs).length,
        totalBakeMs: round(g.audio._storyBakeMs),
        maxChunkMs: round(g.audio._storyPrewarmMaxChunkMs),
        firstStoryLoopMs: round(firstStoryLoopMs),
        waitMs: round(performance.now() - prewarmAt),
      },
    );
    F.teleport('forest');
    F.stepWith(0.1, {}, false);
    g.enemies.clear();
    const forest = g.forest;

    check(
      'two bounded braids share one monotonic progress clock and exact six-metre commitments',
      forest.forks.length === 2
        && forest.forks.every((fork) => fork.commitDistance === 6
          && fork.commitS - fork.startS === 6
          && fork.endS - fork.startS >= 16
          && fork.endS - fork.startS <= 22)
        && forest.forkTopologyStats?.closureCapacity === 60
        && forest.forkClosureMesh?.isInstancedMesh
        && forest.forkDividerMesh?.isInstancedMesh,
      { forks: forest.forks.map((fork) => ({
        id: fork.id, startS: fork.startS, commitS: fork.commitS, endS: fork.endS,
      })), stats: forest.forkTopologyStats },
    );

    const setPlayer = (point) => {
      g.dead = false;
      g.act = 'forest';
      g.player.pos.copy(point);
      g.player.pos.y = forest.heightAt(point.x, point.z) + 0.025;
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.movementLocked = false;
      g.player.frozen = false;
      g.player._sync(0);
    };
    const routeFit = (fork, side, s, point = g.player.pos) => {
      const projection = forest.project(point.x, point.z);
      const offset = forest.forkRouteOffset(fork, s);
      return {
        projection,
        error: projection ? Math.abs(projection.lat - side * offset) : Infinity,
      };
    };

    const routeSamples = [];
    for (const fork of forest.forks) {
      for (const side of [-1, 1]) {
        for (let s = fork.startS + 1; s <= fork.endS - 1; s += 2) {
          const point = forest.forkRoutePoint(fork, side, s);
          const fit = routeFit(fork, side, s, point);
          routeSamples.push({
            fork: fork.id, side, s,
            projectionS: round(fit.projection?.s),
            routeError: round(fit.error),
            ground: round(forest.heightAt(point.x, point.z)),
          });
        }
      }
    }
    check(
      'all four authored ribbons project to matching progress and finite ground',
      routeSamples.every((sample) => Math.abs(sample.projectionS - sample.s) < 0.55
        && sample.routeError < 0.38
        && Number.isFinite(sample.ground)
        && sample.ground > -1),
      routeSamples,
    );

    const combinations = [];
    for (const firstSide of [-1, 1]) {
      for (const secondSide of [-1, 1]) {
        for (const fork of forest.forks) forest._resetFork(fork);
        forest.sealS = -10;
        forest.entered = true;
        const combo = { choices: [firstSide, secondSide], forks: [] };
        for (let index = 0; index < forest.forks.length; index++) {
          const fork = forest.forks[index];
          const side = combo.choices[index];
          forest.reseat(...(() => {
            const p = forest.forkRoutePoint(fork, side, fork.startS + 0.4);
            return [p.x, p.z];
          })());

          // Both branches can be entered, examined for four metres, and left.
          const trials = [];
          for (const trialSide of [-1, 1]) {
            const trialS = fork.startS + 4.0;
            setPlayer(forest.forkRoutePoint(fork, trialSide, trialS));
            forest.clampPlayer(g.player.pos, 1 / 60);
            const fit = routeFit(fork, trialSide, trialS);
            trials.push({ side: trialSide, selected: fork.selected, error: round(fit.error) });
            setPlayer(forest.forkRoutePoint(fork, trialSide, fork.startS + 0.35));
            forest.clampPlayer(g.player.pos, 1 / 60);
          }

          // 5.99m remains a trial. 6.05m on the ribbon commits exactly once.
          setPlayer(forest.forkRoutePoint(fork, side, fork.startS + 5.99));
          forest.clampPlayer(g.player.pos, 1 / 120);
          const beforeCommit = {
            selected: fork.selected,
            activeColliders: fork.closures.rows.flatMap((row) => row.colliders)
              .filter((collider) => collider.forkClosureActive).length,
          };
          setPlayer(forest.forkRoutePoint(fork, side, fork.startS + 6.05));
          forest.clampPlayer(g.player.pos, 1 / 120);
          const parent = fork.closures.rows.find((row) => row.kind === 'parent');
          const chosenMouth = fork.closures.rows.find((row) => row.kind === 'mouth' && row.side === side);
          const rejectedMouth = fork.closures.rows.find((row) => row.kind === 'mouth' && row.side === -side);
          const earlyFrames = [];
          for (const dt of [0, 1 / 120, 1 / 60, 1 / 30]) {
            forest._writeForkClosures(dt);
            const collisionAbove = Math.max(0,
              ...parent.colliders.map((collider) => collider.max.y - parent.centre.y));
            const visibleAbove = Math.max(0, ...parent.entries.map((entry) => {
              const rise = Math.max(0, Math.min(1,
                (parent.t - entry.delay) / (1 - entry.delay)));
              const eased = rise * rise * (3 - 2 * rise);
              return entry.p.y + entry.h * (eased - 0.02) - parent.centre.y;
            }));
            earlyFrames.push({
              dt: round(dt), rowT: round(parent.t),
              collisionAbove: round(collisionAbove), visibleAbove: round(visibleAbove),
            });
          }
          forest._writeForkClosures(0.4);
          forest._updateForestStoryProps(0.05);
          const chosenProp = forest.storyProps.find((prop) => prop.forkId === fork.id && prop.side === side);
          const rejectedProp = forest.storyProps.find((prop) => prop.forkId === fork.id && prop.side === -side);
          const closure = {
            selected: fork.selected,
            parentActive: parent.colliders.every((collider) => collider.forkClosureActive && collider.max.y > 3),
            chosenOpen: chosenMouth.colliders.every((collider) => !collider.forkClosureActive && collider.max.y === collider.min.y),
            rejectedClosed: rejectedMouth.colliders.every((collider) => collider.forkClosureActive && collider.max.y > 3),
            visibleRise: round(parent.t),
            earlyFrames,
            chosenTargetEnabled: chosenProp?.target.enabled,
            rejectedTargetDisabled: rejectedProp ? !rejectedProp.target.enabled : false,
          };

          // Pushing at the rejected route is corrected into the chosen physical
          // envelope; the selected ribbon itself remains unchanged.
          const midS = (fork.commitS + fork.endS) * 0.5;
          setPlayer(forest.forkRoutePoint(fork, -side, midS));
          forest.clampPlayer(g.player.pos, 1 / 60);
          const rejectedProjection = forest.project(g.player.pos.x, g.player.pos.z);
          const selectedOffset = side * forest.forkRouteOffset(fork, rejectedProjection.s);
          const forcedToSelectedError = Math.abs(rejectedProjection.lat - selectedOffset);
          setPlayer(forest.forkRoutePoint(fork, side, midS));
          forest.clampPlayer(g.player.pos, 1 / 60);
          const selectedFit = routeFit(fork, side, midS);

          // A committed checkpoint restores on its route with both walls still
          // up. A checkpoint behind the mouth explicitly dissolves them, so no
          // respawn can ever appear trapped by the new parent closure.
          const committedPose = forest.forkRoutePoint(fork, side, fork.commitS + 2.25);
          setPlayer(committedPose);
          g.dead = true;
          g.director.respawn();
          F.stepWith(0.05, {}, false);
          g.enemies.clear();
          const restored = g.player.pos.clone();
          const restoredFit = routeFit(fork, side, fork.checkpoint.s, restored);
          const committedRestore = {
            selected: fork.selected,
            error: round(restoredFit.error),
            parentActive: parent.colliders.every((collider) => collider.forkClosureActive),
            checkpointS: round(fork.checkpoint?.s),
            checkpointPoseS: round(forest.project(restored.x, restored.z)?.s),
            exclusiveFlag: g.flags.has(`forestFork:${fork.id}:${side < 0 ? 'left' : 'right'}`)
              && !g.flags.has(`forestFork:${fork.id}:${side < 0 ? 'right' : 'left'}`),
          };
          const behind = forest.posAt(fork.startS - 2.0, 0);
          behind.y = forest.heightAt(behind.x, behind.z);
          forest.recentre(behind);
          const behindRestore = {
            selected: fork.selected,
            parentOpen: parent.colliders.every((collider) => !collider.forkClosureActive
              && collider.max.y === collider.min.y),
            s: round(forest.project(behind.x, behind.z)?.s),
          };
          setPlayer(forest.forkRoutePoint(fork, side, fork.commitS + 0.05));
          forest.clampPlayer(g.player.pos, 1 / 120);
          const recommitted = fork.selected === side;

          combo.forks.push({
            id: fork.id,
            side,
            trials,
            beforeCommit,
            closure,
            forcedToSelectedError: round(forcedToSelectedError),
            selectedRouteError: round(selectedFit.error),
            committedRestore,
            behindRestore,
            recommitted,
          });
        }
        combinations.push(combo);
      }
    }
    check(
      'all four branch combinations obey trial, commitment, closure, route, and restore laws',
      combinations.every((combo) => combo.forks.every((fork) =>
        fork.trials.every((trial) => trial.selected == null && trial.error < 0.38)
          && fork.beforeCommit.selected == null
          && fork.beforeCommit.activeColliders === 0
          && fork.closure.selected === fork.side
          && fork.closure.parentActive
          && fork.closure.chosenOpen
          && fork.closure.rejectedClosed
          && fork.closure.visibleRise > 0.7
          && fork.closure.earlyFrames.every((frame) => frame.collisionAbove <= frame.visibleAbove + 0.18)
          && fork.closure.chosenTargetEnabled
          && fork.closure.rejectedTargetDisabled
          && fork.forcedToSelectedError <= forest.forks.find((candidate) => candidate.id === fork.id).routeWidth + 0.05
          && fork.selectedRouteError < 0.38
          && fork.committedRestore.selected === fork.side
          && fork.committedRestore.error < 0.38
          && fork.committedRestore.parentActive
          && Math.abs(fork.committedRestore.checkpointPoseS - fork.committedRestore.checkpointS) < 0.55
          && fork.committedRestore.exclusiveFlag
          && fork.behindRestore.selected == null
          && fork.behindRestore.parentOpen
          && fork.recommitted)),
      combinations,
    );

    // Audio engine invariant: a third story voice is refused even if a caller
    // bypasses the forest's nearest-two allocator.
    forest._stopForestStoryLoops();
    const pannerModels = [];
    const originalPanner = g.audio._panner;
    g.audio._panner = function (...args) {
      const panner = originalPanner.apply(this, args);
      pannerModels.push(panner.panningModel);
      return panner;
    };
    const explicit = [
      g.audio.forestStoryLoop('radio', forest.storyProps[0].targetPos, { gain: 0.1 }),
      g.audio.forestStoryLoop('phone', forest.storyProps[1].targetPos, { gain: 0.1 }),
      g.audio.forestStoryLoop('crt', forest.storyProps[3].targetPos, { gain: 0.1 }),
    ];
    g.audio._panner = originalPanner;
    check(
      'the audio engine itself enforces two continuous HRTF story voices',
      explicit[0] && explicit[1] && explicit[2] == null
        && g.audio._forestStoryLoops.size === 2
        && pannerModels.length === 2
        && pannerModels.every((model) => model === 'HRTF'),
      { handles: explicit.map(Boolean), loopCount: g.audio._forestStoryLoops.size, pannerModels },
    );
    explicit[0]?.stop(); explicit[1]?.stop();

    // Production allocator at the first fork: both opposite objects are heard
    // from their authored coordinates before either one's 15m visual read.
    const firstFork = forest.forks[0];
    forest._resetFork(firstFork);
    forest.sealS = firstFork.startS - 10;
    setPlayer(forest.posAt(61.7, 0));
    forest._updateForestStoryProps(0.2);
    const active = forest.storyProps.filter((prop) => prop.loop);
    const coordinateAgreement = active.map((prop) => ({
      id: prop.id,
      target: posOf(prop.targetPos),
      loop: prop.loop ? [prop.loop.worldPos.x, prop.loop.worldPos.y, prop.loop.worldPos.z].map(round) : null,
      model: prop.loop?.panningModel,
    }));
    check(
      'nearest-two allocation uses exact world anchors and every prop is audible before visible',
      active.length === 2
        && active.every((prop) => prop.loop.panningModel === 'HRTF'
          && Math.hypot(
            prop.loop.worldPos.x - prop.targetPos.x,
            prop.loop.worldPos.y - prop.targetPos.y,
            prop.loop.worldPos.z - prop.targetPos.z,
          ) < 0.001)
        && forest.storyProps.every((prop) => prop.audibleBeforeVisible
          && prop.audibleRadius > prop.visibleReadRadius * 2),
      { active: coordinateAgreement, storySoundStats: forest.storySoundStats },
    );

    const noiseHooks = [];
    const originalNoiseHook = g.director.forestNoise;
    g.director.forestNoise = (...args) => noiseHooks.push(args);
    const victim = active[0];
    const victimLoop = victim.loop;
    victim.target.onHit(g.skull, victim.targetPos);
    forest._updateForestStoryProps(0.5);
    if (originalNoiseHook) g.director.forestNoise = originalNoiseHook;
    else delete g.director.forestNoise;
    check(
      'a skull hit visibly silences one prop and publishes a loud optional consequence hook',
      victim.silenced
        && !victim.target.enabled
        && victim.loop == null
        && victimLoop._dead
        && victim.visualLevel < 0.08
        && victim.glowMat.emissiveIntensity < 0.1
        && g.player.noise >= 0.99
        && g.flags.has(`forestStorySilenced:${victim.id}`)
        && noiseHooks.length === 1
        && noiseHooks[0][1] === 1
        && noiseHooks[0][2] === 'appliance',
      {
        id: victim.id,
        targetEnabled: victim.target.enabled,
        loopDead: victimLoop._dead,
        visualLevel: round(victim.visualLevel),
        emissive: round(victim.glowMat.emissiveIntensity),
        playerNoise: round(g.player.noise),
        hook: noiseHooks.map((event) => [posOf(event[0]), event[1], event[2]]),
      },
    );

    // Each lifecycle boundary owns cleanup. Recreate a voice between probes so
    // this proves seal, death, act change, and terminal independently.
    const lifecycle = [];
    const speaker = forest.storyProps.find((prop) => !prop.silenced && !prop.forkId);
    const armSpeaker = () => {
      g.act = 'forest'; g.dead = false; g.terminal = false; g.endingTail = false;
      forest.sealS = speaker.s - 12;
      setPlayer(speaker.targetPos);
      forest._updateForestStoryProps(0.2);
      return speaker.loop;
    };
    let loop = armSpeaker();
    forest.sealS = forest.length;
    forest._updateForestStoryProps(0.1);
    lifecycle.push({
      boundary: 'seal', created: !!loop, stopped: !!loop?._dead,
      active: g.audio._forestStoryLoops.size, targetDisabled: !speaker.target.enabled,
    });
    loop = armSpeaker();
    g.dead = true;
    forest._updateForestStoryProps(0.1);
    lifecycle.push({ boundary: 'death', created: !!loop, stopped: !!loop?._dead, active: g.audio._forestStoryLoops.size });
    loop = armSpeaker();
    g.act = 'clearing';
    forest._updateForestStoryProps(0.1);
    lifecycle.push({ boundary: 'act', created: !!loop, stopped: !!loop?._dead, active: g.audio._forestStoryLoops.size });
    loop = armSpeaker();
    g.terminal = true;
    forest._updateForestStoryProps(0.1);
    lifecycle.push({ boundary: 'terminal', created: !!loop, stopped: !!loop?._dead, active: g.audio._forestStoryLoops.size });
    check(
      'story voices cleanly release on seal, death, act change, and terminal end',
      lifecycle.every((entry) => entry.created && entry.stopped && entry.active === 0)
        && lifecycle[0].targetDisabled,
      lifecycle,
    );

    return checks;
  });

  for (const result of report.checks) {
    console.log(`  ${result.passed ? 'PASS' : 'FAIL'} ${result.name}`
      + (result.details == null ? '' : ` -- ${JSON.stringify(result.details)}`));
    if (!result.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(`  browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
  writeFileSync(resultsPath('forest-nervous-system-regression.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);

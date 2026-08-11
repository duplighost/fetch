// Broad composition gate for FETCH's exact shipped renderer path.
// Focused Stage-C gates own legal action edges, deterministic cold district
// probes, and exhaustive owner identity. This matrix keeps the cross-system
// pressure that only the whole itinerary can provide: immediate Wake races,
// every story-order seam, warmup purity, context loss in house/cave/Finale,
// mirror failure containment, and the long Underfalls simulation tail.
import { writeFileSync } from 'node:fs';
import {
  ensureServer, launchBrowser, openPage, URL_BASE, resultsPath,
} from './lib/harness.mjs';

const SEAMS = [
  ['house->graveyard', 'graveyard'],
  ['graveyard->ossuary', 'ossuary'],
  ['ossuary->forest', 'forest'],
  ['forest->clearing', 'clearing'],
  ['clearing->cave', 'cave'],
  ['cave->mirror', 'mirror'],
];
const failures = [];
const report = {
  url: `${URL_BASE}/?test=1&mute=1&warmup=1&warmupRace=1`,
  audioPurityUrl: `${URL_BASE}/?test=1&warmup=1`,
  renderer: null,
  race: null,
  contextRecovery: null,
  houseFailures: null,
  purity: null,
  settled: [],
  caveTail: null,
  browserErrors: [],
};
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};
const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
};
const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
const exactP16LightCensus = (types) => types?.total === 20
  && types.AmbientLight === 1
  && types.HemisphereLight === 1
  && types.DirectionalLight === 1
  && types.SpotLight === 1
  && types.PointLight === 16
  && types.directionalShadows === 1
  && types.spotShadows === 0
  && types.pointShadows === 0
  && types.totalShadows === 1;
const boundedResidencyTransaction = (entry) => {
  if (!entry || entry.objects < 1 || entry.geometries < 0) return false;
  const withinOrdinaryCaps = entry.objects <= 32 && entry.geometries <= 16
    && entry.geometryBytes <= 512 * 1024 && entry.submittedElements <= 16 * 1024;
  const isolatedOversize = entry.isolatedOversize === true
    && entry.objects === 1 && entry.geometries === 1
    && typeof entry.oversize?.reason === 'string' && entry.oversize.reason.length > 0;
  return withinOrdinaryCaps || isolatedOversize;
};
const validExactPreload = (entry) => boundedResidencyTransaction(entry)
  && entry.error == null && entry.committed === true && entry.stateRestored === true
  && entry.generationStable === true && entry.fingerprintsStable === true
  && entry.queuePrefixStable === true && entry.programDelta === 0
  && entry.textureDelta === 0 && entry.geometryDelta >= 0
  && entry.geometryDelta <= entry.geometries
  && entry.programSelectionObjects === entry.objects
  && entry.programSelectionDurationMs < 100 && entry.durationMs < 100
  && ((entry.rig === 'held' && entry.lights === 2)
    || (entry.rig === 'world' && entry.lights === 20));
const validUniverseFinalizerAttempt = (entry) => entry?.error == null
  && entry.scanDurationMs < 100 && entry.recordDurationMs < 100
  && entry.durationMs < 100 && typeof entry.recorded === 'boolean';
const finalizerGroupKey = (entry) => [
  entry?.generation, entry?.key, entry?.scope, entry?.kind,
].join('|');
const convergedUniverseFinalizers = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0
      || !entries.every(validUniverseFinalizerAttempt)) return false;
  const groups = new Map();
  for (const entry of entries) {
    const key = finalizerGroupKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.values()].every((attempts) =>
    attempts.at(-1)?.recorded === true
      && attempts.filter((entry) => entry.recorded).length === 1);
};
const finalizerAttemptsOwnZeroDrawFrames = (entries, frames) =>
  Array.isArray(entries) && Array.isArray(frames)
  && entries.length === frames.length
  && frames.every((frame) => validUniverseFinalizerAttempt(frame)
    && Number.isInteger(frame.frameId) && frame.frameId > 0
    && frame.renderMs < 100 && frame.worldDrawCalls === 0 && frame.drawCalls === 0
    && frame.generation === frame.renderGeneration
    && frame.key === frame.renderKey);
const finalizersOwnZeroDrawFrames = (entries, frames) =>
  finalizerAttemptsOwnZeroDrawFrames(entries, frames)
  && convergedUniverseFinalizers(entries);
const matchingFinalizerFrames = (entries, frames) => {
  const keys = new Set((entries || []).map(finalizerGroupKey));
  return (frames || []).filter((entry) => keys.has(finalizerGroupKey(entry)));
};

async function ready(page) {
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game?.renderer,
    null, { timeout: 90000, polling: 50 },
  );
}

async function runImmediateRace(browser) {
  const opened = await openPage(browser, report.url);
  const { page } = opened;
  await ready(page);
  const value = await page.evaluate(async ({ seams }) => {
    const g = window.__game, F = window.__FETCH;
    const intervals = [];
    const slowObserved = [];
    const renders = [];
    // Start-to-start includes the preceding render's own duration. Keep it for
    // diagnosis, especially across Wake's first hidden upload, but gate the
    // independently owned render, idle, completion and observed intervals.
    const renderCadence = (rows) => ({
      renderCount: rows.length,
      maxRenderStartIntervalMs: Math.max(0, ...rows.slice(1)
        .map((row, index) => row.startedAt - rows[index].startedAt)),
      maxInterRenderIdleMs: Math.max(0, ...rows.slice(1)
        .map((row, index) => row.startedAt - rows[index].completedAt)),
      maxRenderCompletionIntervalMs: Math.max(0, ...rows.slice(1)
        .map((row, index) => row.completedAt - rows[index].completedAt)),
    });
    const orderingErrors = [];
    const finalizerFrames = [];
    const seenFinalizers = new WeakSet();
    let frameSerial = 0;
    let lastCompletedRender = null;
    let wakeAt = null;
    let previous = null;
    let sampling = true;
    const raf = () => {
      if (!sampling) return;
      const observedAt = performance.now();
      const completed = lastCompletedRender;
      if (completed) {
        if (previous) {
          const ordered = completed.frameId > previous.frameId
            && completed.completedAt <= observedAt
            && previous.completedAt <= previous.observedAt;
          if (ordered) {
            const durationMs = observedAt - previous.observedAt;
            intervals.push(durationMs);
            if (durationMs >= 80 && slowObserved.length < 16) {
              slowObserved.push({
                durationMs,
                previous: {
                  frameId: previous.frameId,
                  startedAt: previous.startedAt,
                  completedAt: previous.completedAt,
                  observedAt: previous.observedAt,
                },
                current: {
                  frameId: completed.frameId,
                  startedAt: completed.startedAt,
                  completedAt: completed.completedAt,
                  observedAt,
                },
              });
            }
          }
          else if (orderingErrors.length < 16) {
            orderingErrors.push({ previous, current: { ...completed, observedAt } });
          }
        }
        previous = { ...completed, observedAt };
      }
      requestAnimationFrame(raf);
    };

    const realRender = g.render;
    g.render = function raceRender(...args) {
      const beforePrograms = g.renderer.info.programs?.length ?? 0;
      const beforeTextures = g.renderer.info.memory.textures;
      const beforeGeometries = g.renderer.info.memory.geometries;
      const startedAt = performance.now();
      try { return realRender.apply(this, args); }
      finally {
        const completedAt = performance.now();
        const row = {
          frameId: ++frameSerial,
          act: g.act,
          generation: g._webglGeneration,
          startedAt,
          completedAt,
          atMs: completedAt,
          ms: completedAt - startedAt,
          beforePrograms,
          afterPrograms: g.renderer.info.programs?.length ?? 0,
          beforeTextures,
          afterTextures: g.renderer.info.memory.textures,
          beforeGeometries,
          afterGeometries: g.renderer.info.memory.geometries,
          drawCalls: g.lastRender?.drawCalls || 0,
          worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
          shielded: !!g._shaderTransitionShield,
          reducedDetail: !!g.lastRender?.reducedDetail,
          residencyKey: g.lastRender?.residencyKey || null,
          bootstrapKind: g.lastRender?.bootstrapKind || null,
          snapshotProgress: !!g.lastRender?.snapshotProgress,
          reducedBatchSubmitted: !!g.lastRender?.reducedBatchSubmitted,
          reducedBatchRevealed: !!g.lastRender?.reducedBatchRevealed,
          ownerProgress: !!g.lastRender?.ownerProgress,
          deferredProgress: !!g.lastRender?.deferredProgress,
          ownerExactProgress: !!g.lastRender?.ownerExactProgress,
          deferredExactProgress: !!g.lastRender?.deferredExactProgress,
          visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
          visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
          visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
        };
        renders.push(row);
        lastCompletedRender = row;
        for (const entry of g.currentGpuResidency?.universeFinalizePasses || []) {
          if (seenFinalizers.has(entry)) continue;
          seenFinalizers.add(entry);
          finalizerFrames.push({
            ...entry,
            frameId: row.frameId,
            renderGeneration: row.generation,
            renderKey: g.currentGpuResidency?.progressive?.key || null,
            renderMs: row.ms,
            worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
            drawCalls: g.lastRender?.drawCalls || 0,
            reducedDetail: !!g.lastRender?.reducedDetail,
          });
        }
      }
    };
    requestAnimationFrame(raf);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const warmupBeforeStart = g.shaderWarmup.status;
    const startAt = performance.now();
    wakeAt = startAt;
    F.start();
    const startMs = performance.now() - startAt;
    g._selfStep = true;
    g.teleport('house');
    if (g.act !== 'house') throw new Error(`immediate Wake landed in ${g.act}, not house`);
    const countPointLights = () => {
      let count = 0;
      g.scene.traverse((object) => { if (object.isPointLight) count++; });
      return count;
    };
    const impactRenderIndex = renders.length;
    const impactIntervalIndex = intervals.length;
    const impactSlowObservedIndex = slowObserved.length;
    const impactBefore = {
      pointLights: countPointLights(),
      sceneChildren: g.scene.children.length,
      lightUuid: g._impactLight?.uuid || null,
      ringUuid: g._impactRing?.uuid || null,
      ringVisible: g._impactRing?.visible ?? null,
      bootPrime: g._impactRing?.userData?.bootPrime ?? null,
    };
    g.impact('locked', g.player.pos.clone().setY(g.player.pos.y + 1));
    const impactActivation = {
      ringVisible: !!g._impactRing?.visible,
      bootPrime: !!g._impactRing?.userData?.bootPrime,
      ringT: g._ringT,
      ringIn: !!g._ringIn,
      lightIntensity: g._impactLight?.intensity || 0,
      hitStop: g.hitStop || 0,
    };
    for (let i = 0; i < 5; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
    const impactRenders = renders.slice(impactRenderIndex);
    const impactIntervals = intervals.slice(impactIntervalIndex);
    const firstImpact = {
      before: impactBefore,
      activation: impactActivation,
      after: {
        pointLights: countPointLights(),
        sceneChildren: g.scene.children.length,
        lightUuid: g._impactLight?.uuid || null,
        ringUuid: g._impactRing?.uuid || null,
        ringVisible: g._impactRing?.visible ?? null,
        bootPrime: g._impactRing?.userData?.bootPrime ?? null,
      },
      maxRafMs: Math.max(0, ...impactIntervals),
      maxRenderMs: Math.max(0, ...impactRenders.map((entry) => entry.ms)),
      ...renderCadence(impactRenders),
      renderRows: impactRenders,
      slowObserved: slowObserved.slice(impactSlowObservedIndex),
      visibleRenderProgramDelta: Math.max(0, ...impactRenders.map((entry) =>
        entry.visibleProgramDelta)),
      visibleRenderTextureDelta: Math.max(0, ...impactRenders.map((entry) =>
        entry.visibleTextureDelta)),
      visibleRenderGeometryDelta: Math.max(0, ...impactRenders.map((entry) =>
        entry.visibleGeometryDelta)),
    };
    const earlyPriorityBefore = g._shaderWarmPriorityChanges || 0;
    const earlyPriorityKeys = [];
    for (const earlyAct of ['bedroom', 'house', 'basement']) {
      F.teleport(earlyAct);
      if (g.act !== earlyAct) throw new Error(`early priority teleport landed in ${g.act}, not ${earlyAct}`);
      earlyPriorityKeys.push(g._shaderWarmPriorityKey());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    F.teleport('house');
    if (g.act !== 'house') throw new Error(`early priority return landed in ${g.act}, not house`);
    const earlyHousePriority = {
      keys: earlyPriorityKeys,
      restarts: (g._shaderWarmPriorityChanges || 0) - earlyPriorityBefore,
    };
    const fullHouseDeadline = wakeAt + 600;
    while (!renders.some((entry) => entry.atMs >= wakeAt && entry.worldDrawCalls > 0
        && !entry.reducedDetail) && performance.now() < fullHouseDeadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const houseRenders = renders.filter((entry) => entry.atMs >= wakeAt);
    const firstHouseWorld = houseRenders.find((entry) => entry.worldDrawCalls > 0) || null;
    const firstHouseFull = houseRenders.find((entry) => entry.worldDrawCalls > 0
      && !entry.reducedDetail) || null;
    const houseLights = [];
    g.scene.traverseVisible((object) => {
      if (object.isLight && (object.layers.mask & 3) !== 0) houseLights.push(object);
    });
    const houseLightTypes = houseLights.reduce((out, light) => {
      out[light.type] = (out[light.type] || 0) + 1;
      if (light.castShadow) {
        out.totalShadows = (out.totalShadows || 0) + 1;
        if (light.isDirectionalLight) out.directionalShadows =
          (out.directionalShadows || 0) + 1;
      }
      return out;
    }, { totalShadows: 0, directionalShadows: 0 });
    const wakeHouse = {
      wakeToFirstWorldMs: firstHouseWorld ? firstHouseWorld.atMs - wakeAt : null,
      wakeToFirstFullMs: firstHouseFull ? firstHouseFull.atMs - wakeAt : null,
      firstWorld: firstHouseWorld,
      firstFull: firstHouseFull,
      shieldFrames: houseRenders.filter((entry) => entry.shielded).length,
      worldLights: houseLights.length,
      lightTypes: houseLightTypes,
      maxShieldDurationMs: Math.max(
        g.shaderWarmup.maxShieldDurationMs || 0,
        g.shaderWarmup.shieldStartedAt == null
          ? 0 : performance.now() - g.shaderWarmup.shieldStartedAt,
      ),
    };
    const transitions = [];
    // These impossible-fast transitions install authored post-story state as a
    // renderer fixture. They do not claim that the player earned the state;
    // the focused dynamics gate owns the real waterfall, catch, and district
    // traversal paths.
    for (const [name, act] of seams) {
      if (act === 'cave' && !g.flags.has('waterfallTaken')) {
        g.director.waterfallTaken();
        g.skull.vanish();
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const renderIndex = renders.length;
      const at = performance.now();
      if (act === 'ossuary') {
        const ossuary = g.ossuary;
        ossuary.unlock('transition-warmup-race');
        g.enemies.clear();
        g.skull.holdNow();
        const connector = ossuary.entranceConnector;
        g.player.pos.set(
          g.ritualMausoleum.x,
          ossuary.origin.floor + 0.34,
          connector.portalZ + 0.08,
        );
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        F.stepWith(1 / 120, {}, false);
        if (!ossuary.inOssuary) throw new Error('physical ossuary entry did not cross');
      } else F.teleport(act);
      if (act === 'ossuary') {
        if (g.act !== 'graveyard' || !g.ossuary.inOssuary) {
          throw new Error(`physical ossuary race landed in ${g.act} without ossuary ownership`);
        }
      } else if (g.act !== act) {
        throw new Error(`${name} race landed in ${g.act}, not ${act}`);
      }
      const transitionMs = performance.now() - at;
      const expectedGeneration = g._webglGeneration;
      const expectedKey = g._currentGpuResidencyKey();
      const seamIntervals = [];
      const seamOrderingErrors = [];
      let previousSeamFrame = null;
      const destinationRenders = () => renders.slice(renderIndex).filter((entry) =>
        entry.startedAt >= at && entry.generation === expectedGeneration
          && entry.residencyKey === expectedKey);
      // Attack faster than human traversal, but wait up to the explicit brief
      // shield budget so a seam cannot pass merely because all eight sampled
      // frames were opaque. Ordinary gameplay should reveal much earlier.
      let sampledFrames = 0;
      const revealDeadline = performance.now() + 600;
      while (sampledFrames < 8
          || (!destinationRenders().some((entry) => entry.worldDrawCalls > 0)
            && performance.now() < revealDeadline)) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const observedAt = performance.now();
        const completed = lastCompletedRender;
        const ordered = completed && completed.startedAt >= at
          && completed.completedAt <= observedAt
          && completed.generation === expectedGeneration
          && completed.residencyKey === expectedKey
          && (!previousSeamFrame || completed.frameId > previousSeamFrame.frameId
            && previousSeamFrame.completedAt <= previousSeamFrame.observedAt);
        if (ordered) {
          if (previousSeamFrame) {
            seamIntervals.push(observedAt - previousSeamFrame.observedAt);
          }
          previousSeamFrame = { ...completed, observedAt };
        } else if (seamOrderingErrors.length < 16) {
          seamOrderingErrors.push({
            previous: previousSeamFrame,
            current: completed,
            observedAt,
            expectedGeneration,
            expectedKey,
          });
        }
        sampledFrames++;
      }
      const seamRenders = destinationRenders();
      const firstWorld = seamRenders.find((entry) => entry.worldDrawCalls > 0) || null;
      const firstShield = seamRenders.find((entry) => entry.shielded) || null;
      const firstUnshieldAfter = firstShield
        ? seamRenders.find((entry) => !entry.shielded && entry.atMs >= firstShield.atMs)
        : null;
      transitions.push({
        name,
        expectedGeneration,
        expectedKey,
        orderingErrors: seamOrderingErrors,
        rafIntervals: seamIntervals.length,
        transitionMs,
        maxRafMs: Math.max(0, ...seamIntervals),
        p95RafMs: (() => {
          const sorted = [...seamIntervals].sort((a, b) => a - b);
          return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1))] || 0;
        })(),
        maxRenderMs: Math.max(0, ...seamRenders.map((entry) => entry.ms)),
        ...renderCadence(seamRenders),
        firstWorldMs: firstWorld ? firstWorld.atMs - at : null,
        worldSubmitted: !!firstWorld,
        shieldFrames: seamRenders.filter((entry) => entry.shielded).length,
        shieldDurationMs: firstShield
          ? (firstUnshieldAfter?.atMs || performance.now()) - firstShield.atMs : 0,
        visibleRenderProgramDelta: Math.max(0, ...seamRenders.map((entry) =>
          entry.visibleProgramDelta)),
        visibleRenderTextureDelta: Math.max(0, ...seamRenders.map((entry) =>
          entry.visibleTextureDelta)),
        visibleRenderGeometryDelta: Math.max(0, ...seamRenders.map((entry) =>
          entry.visibleGeometryDelta)),
        reducedFrames: seamRenders.filter((entry) => entry.reducedDetail).length,
        programs: g.renderer.info.programs?.length ?? 0,
        textures: g.renderer.info.memory.textures,
        warmupStatus: g.shaderWarmup.status,
        targetsWarmed: g.finale._targetWarmState?.warmed || 0,
        cleanupMs: 0,
      });
      if (act === 'ossuary') {
        const cleanupStartedAt = performance.now();
        for (let index = 0; index < 15 && g.ossuary.portalCooldown > 0; index++) {
          F.stepWith(0.04, {}, false);
        }
        g.player.pos.set(g.ossuary.origin.x, g.ossuary.origin.floor,
          g.ossuary.origin.z + 0.2);
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        F.stepWith(1 / 120, {}, false);
        if (g.ossuary.inOssuary || g.ossuary.root.visible) {
          throw new Error('physical ossuary backtrack did not restore the graveyard');
        }
        transitions.at(-1).cleanupMs = performance.now() - cleanupStartedAt;
      }
    }
    const returnRenderIndex = renders.length;
    const returnRestartCount = g._shaderWarmPriorityChanges || 0;
    const returnResidentBefore = [
      ...(g.currentGpuResidency?.physical || []),
      ...(g.currentGpuResidency?.reduced || []),
    ].some((key) => key.includes(':forest:forest'));
    const returnAt = performance.now();
    F.teleport('forest');
    if (g.act !== 'forest') throw new Error(`rapid return landed in ${g.act}, not forest`);
    const returnGeneration = g._webglGeneration;
    const returnKey = g._currentGpuResidencyKey();
    const returnIntervals = [];
    const returnOrderingErrors = [];
    let previousReturnFrame = null;
    const destinationReturnRenders = () => renders.slice(returnRenderIndex)
      .filter((entry) => entry.startedAt >= returnAt
        && entry.generation === returnGeneration && entry.residencyKey === returnKey);
    let returnSamples = 0;
    const returnDeadline = performance.now() + 600;
    while (returnSamples < 8
        || (!destinationReturnRenders().some((entry) => entry.worldDrawCalls > 0)
          && performance.now() < returnDeadline)) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const observedAt = performance.now();
      const completed = lastCompletedRender;
      const ordered = completed && completed.startedAt >= returnAt
        && completed.completedAt <= observedAt
        && completed.generation === returnGeneration
        && completed.residencyKey === returnKey
        && (!previousReturnFrame || completed.frameId > previousReturnFrame.frameId
          && previousReturnFrame.completedAt <= previousReturnFrame.observedAt);
      if (ordered) {
        if (previousReturnFrame) {
          returnIntervals.push(observedAt - previousReturnFrame.observedAt);
        }
        previousReturnFrame = { ...completed, observedAt };
      } else if (returnOrderingErrors.length < 16) {
        returnOrderingErrors.push({
          previous: previousReturnFrame,
          current: completed,
          observedAt,
          expectedGeneration: returnGeneration,
          expectedKey: returnKey,
        });
      }
      returnSamples++;
    }
    const returnRenders = destinationReturnRenders();
    const residentReturn = {
      residentBefore: returnResidentBefore,
      expectedGeneration: returnGeneration,
      expectedKey: returnKey,
      orderingErrors: returnOrderingErrors,
      rafIntervals: returnIntervals.length,
      restarts: (g._shaderWarmPriorityChanges || 0) - returnRestartCount,
      worldSubmitted: returnRenders.some((entry) => entry.worldDrawCalls > 0),
      firstWorldMs: (() => {
        const first = returnRenders.find((entry) => entry.worldDrawCalls > 0);
        return first ? first.atMs - returnAt : null;
      })(),
      visibleProgramDelta: Math.max(0, ...returnRenders.map((entry) =>
        entry.visibleProgramDelta)),
      visibleTextureDelta: Math.max(0, ...returnRenders.map((entry) =>
        entry.visibleTextureDelta)),
      visibleGeometryDelta: Math.max(0, ...returnRenders.map((entry) =>
        entry.visibleGeometryDelta)),
      maxRafMs: Math.max(0, ...returnIntervals),
      ...renderCadence(returnRenders),
    };
    sampling = false;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    g.render = realRender;
    const postWakeRenders = renders.filter((entry) => entry.atMs >= wakeAt);
    const firstWorld = postWakeRenders.find((entry) => entry.worldDrawCalls > 0) || null;
    const paint = Object.fromEntries(performance.getEntriesByType('paint')
      .map((entry) => [entry.name, entry.startTime]));
    return {
      warmupBeforeStart,
      startMs,
      maxRafMs: Math.max(0, ...intervals),
      rafIntervals: intervals.length,
      orderingErrors,
      slowObserved,
      p95RafMs: (() => {
        const sorted = [...intervals].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1))] || 0;
      })(),
      maxRenderMs: Math.max(0, ...renders.map((entry) => entry.ms)),
      ...renderCadence(renders),
      wakeToFirstWorldMs: firstWorld ? firstWorld.atMs - wakeAt : null,
      firstWorld,
      bootTiming: { ...g.bootTiming },
      paint,
      moonShadow: {
        mapSize: [g.world.moon.shadow.mapSize.x, g.world.moon.shadow.mapSize.y],
        mapUuid: g.world.moon.shadow.map?.uuid || null,
        pending: !!g.world._moonShadowFreezePending,
        armed: !!g.world._moonShadowPrimeArmed,
        inFlight: !!g.world._moonShadowPrimeInFlight,
        started: g.started,
      },
      flamePool: {
        initialized: !!g.flameCircuit?.initialized,
        embers: g.flameCircuit?.embers?.length || 0,
        sparks: g.flameCircuit?.transferSparks?.length || 0,
        prewarmPending: !!g.flameCircuit?.prewarmPending,
      },
      maxShieldDurationMs: Math.max(
        g.shaderWarmup.maxShieldDurationMs || 0,
        g.shaderWarmup.shieldStartedAt == null
          ? 0 : performance.now() - g.shaderWarmup.shieldStartedAt,
      ),
      firstImpact,
      earlyHousePriority,
      residentReturn,
      wakeHouse,
      transitions,
      warmup: { ...g.shaderWarmup },
      residency: {
        generation: g.currentGpuResidency?.generation,
        activeKey: g.currentGpuResidency?.activeKey || null,
        progressiveKey: g.currentGpuResidency?.progressive?.key || null,
        bootstrapStatus: g.currentGpuResidency?.bootstrapStatus || null,
        surfaceStatus: g.currentGpuResidency?.surfaceStatus || null,
        bootstrapNext: g.currentGpuResidency?.bootstrapNext ?? null,
        bootstrapPasses: [...(g.currentGpuResidency?.bootstrapPasses || [])],
        surfacePasses: [...(g.currentGpuResidency?.surfacePasses || [])],
        snapshotPasses: [...(g.currentGpuResidency?.snapshotPasses || [])],
        physical: [...(g.currentGpuResidency?.physical || [])],
        reduced: [...(g.currentGpuResidency?.reduced || [])],
        owners: [...(g.currentGpuResidency?.owners || [])],
        exactPasses: [...(g.currentGpuResidency?.exactPasses || [])],
        exactPreloadPasses: [...(g.currentGpuResidency?.exactPreloadPasses || [])],
        reducedPasses: [...(g.currentGpuResidency?.reducedPasses || [])],
        ownerPasses: [...(g.currentGpuResidency?.ownerPasses || [])],
        ownerUniverses: [...(g.currentGpuResidency?.ownerUniverses || [])],
        deferredUniverses: [...(g.currentGpuResidency?.deferredUniverses || [])],
        universeFinalizePasses: [...(g.currentGpuResidency?.universeFinalizePasses || [])],
        finalizerFrames,
        skullWorldPasses: [...(g.currentGpuResidency?.skullWorldPasses || [])],
        maxExactMs: g.currentGpuResidency?.maxExactMs || 0,
        maxExactPreloadMs: g.currentGpuResidency?.maxExactPreloadMs || 0,
        maxReducedPrimeMs: g.currentGpuResidency?.maxReducedPrimeMs || 0,
        maxOwnerMs: g.currentGpuResidency?.maxOwnerMs || 0,
        reducedFrames: g.currentGpuResidency?.reducedFrames || 0,
        ownerFullFrames: g.currentGpuResidency?.ownerFullFrames || 0,
        deferredFullFrames: g.currentGpuResidency?.deferredFullFrames || 0,
        errors: [...(g.currentGpuResidency?.errors || [])],
      },
    };
  }, { seams: SEAMS });
  report.browserErrors.push(...opened.errors.map((error) => `race: ${error}`));
  await page.close();
  return value;
}

async function runContinuousViewResidency(browser) {
  const opened = await openPage(browser, report.url);
  const { page } = opened;
  await ready(page);
  const value = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    const waitFor = async (predicate, label, timeout = 90000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      if (!predicate()) throw new Error(`timed out waiting for ${label}`);
    };
    const renderableIds = (roots) => {
      const ids = new Set();
      for (const root of roots) root?.traverse((object) => {
        if ((object.isMesh || object.isLine || object.isPoints)
            && object.geometry && object.material) ids.add(object.uuid);
      });
      return [...ids].sort();
    };
    const realRender = g.render;
    // Let predictive shader/texture work settle without accidentally uploading
    // the gameplay scene before this focused continuous-camera adversary begins.
    g.render = () => {};
    F.start();
    g._selfStep = false;
    await waitFor(() => g.shaderWarmup?.status === 'ready', 'predictive warmup');
    // Establish the real house district before the residency transaction starts;
    // later mirror eligibility must not launder the proof through an act/key reset.
    F.teleport('house');
    g._selfStep = false;

    const originalPose = {
      pos: g.player.pos.clone(), yaw: g.player.yaw, pitch: g.player.pitch,
    };
    let baseMesh = null;
    const considerBaseMesh = (object) => {
      if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh
          || !object.geometry?.attributes?.position || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some((material) => material?.visible !== false
          && (!material.transparent || (material.opacity ?? 1) > 0.001))) return;
      if (!baseMesh || object.geometry.attributes.position.count
          < baseMesh.geometry.attributes.position.count) baseMesh = object;
    };
    for (const root of g.houseRenderRoots || []) root?.traverse(considerBaseMesh);
    if (!baseMesh) throw new Error('no simple source mesh for continuous-view probes');
    const makeProbe = (label, bearing) => {
      const probe = baseMesh.clone(false);
      probe.name = `continuous-view-${label}`;
      probe.geometry = baseMesh.geometry.clone();
      probe.material = baseMesh.material;
      probe.visible = true;
      probe.frustumCulled = true;
      probe.castShadow = false;
      probe.receiveShadow = false;
      probe.layers.set(0);
      probe.position.set(
        originalPose.pos.x - Math.sin(bearing) * 3.2,
        originalPose.pos.y + 1.1,
        originalPose.pos.z - Math.cos(bearing) * 3.2,
      );
      probe.rotation.set(0, 0, 0);
      probe.scale.setScalar(0.18);
      g.scene.add(probe);
      g.houseRenderRoots.push(probe);
      return probe;
    };
    const probes = {
      physicalFailure: makeProbe('physical-failure', originalPose.yaw),
      critical: makeProbe('critical-cold', originalPose.yaw + Math.PI),
      owner: makeProbe('owner-cold', originalPose.yaw - Math.PI / 2),
      ownerFailure: makeProbe('owner-failure', originalPose.yaw + Math.PI / 2),
    };
    const cloneFailureInjections = {
      [probes.physicalFailure.uuid]: 1,
      [probes.ownerFailure.uuid]: 1,
    };
    const cloneFailureHits = {
      physical: 0,
      owner: 0,
    };
    const realCloneReduced = g._cloneReducedRenderable;
    g._cloneReducedRenderable = function injectedCloneFailure(object, options) {
      if ((cloneFailureInjections[object.uuid] || 0) > 0) {
        cloneFailureInjections[object.uuid]--;
        if (object === probes.physicalFailure) cloneFailureHits.physical++;
        if (object === probes.ownerFailure) cloneFailureHits.owner++;
        return null;
      }
      return realCloneReduced.call(this, object, options);
    };
    const renders = [];
    const intervals = [];
    let previousRaf = null;
    let sampling = true;
    const sampleRaf = () => {
      const observedAt = performance.now();
      if (previousRaf != null) intervals.push(observedAt - previousRaf);
      previousRaf = observedAt;
      if (sampling) requestAnimationFrame(sampleRaf);
    };
    requestAnimationFrame(sampleRaf);
    g._resetCurrentGpuResidency('continuous-camera-adversary');
    g.render = function measuredContinuousRender(...args) {
      const before = {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      };
      const startedAt = performance.now();
      const ownerPassesBefore = g.currentGpuResidency?.ownerPasses?.length || 0;
      try { return realRender.apply(this, args); }
      finally {
        const progress = g.currentGpuResidency?.progressive;
        renders.push({
          atMs: performance.now(),
          ms: performance.now() - startedAt,
          drawCalls: g.lastRender?.drawCalls || 0,
          reducedDetail: !!g.lastRender?.reducedDetail,
          visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
          visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
          visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
          rawProgramDelta: (g.renderer.info.programs?.length || 0) - before.programs,
          rawTextureDelta: g.renderer.info.memory.textures - before.textures,
          rawGeometryDelta: g.renderer.info.memory.geometries - before.geometries,
          physical: g.currentGpuResidency?.physical?.has(progress?.key) || false,
          queue: progress?.queue?.length || 0,
          ownerQueue: progress?.ownerQueue?.length || 0,
          criticalRefreshes: progress?.criticalRefreshes || 0,
          criticalPromotedObjects: progress?.criticalPromotedObjects || 0,
          ownerPromotionChecks: progress?.ownerPromotionChecks || 0,
          ownerPromotedObjects: progress?.ownerPromotedObjects || 0,
          ownerProgress: !!g.lastRender?.ownerProgress,
          ownerPassCount: g.currentGpuResidency?.ownerPasses?.length || 0,
          ownerPassDelta: (g.currentGpuResidency?.ownerPasses?.length || 0)
            - ownerPassesBefore,
        });
      }
    };
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await waitFor(() => g.currentGpuResidency?.progressive?.snapshotReady
      && g.currentGpuResidency.progressive.ownerQueue.length > 0,
    'initial split residency queues');

    const hasVisibleAncestors = (object) => {
      let ancestor = object;
      while (ancestor && ancestor !== g.scene) {
        if (ancestor.visible === false) return false;
        ancestor = ancestor.parent;
      }
      return ancestor === g.scene;
    };
    const faceOwnerCandidate = (preferredObject = null) => {
      const progress = g.currentGpuResidency.progressive;
      const Vector = g.camera.position.constructor;
      const forward = new Vector();
      g.camera.getWorldDirection(forward);
      const candidates = progress.ownerQueue
        .filter((entry) => entry.preloadOwner === 'house'
          && hasVisibleAncestors(entry.object)
          && (entry.object.layers.mask & 3) !== 0)
        .map((entry) => {
          const target = new Vector();
          entry.object.getWorldPosition(target);
          const direction = target.clone().sub(g.camera.position);
          const distance = direction.length();
          if (distance > 0.001) direction.multiplyScalar(1 / distance);
          return { entry, target, distance, dot: direction.dot(forward) };
        })
        .filter((candidate) => candidate.distance > 0.1)
        .sort((a, b) => Number(b.entry.object === preferredObject)
          - Number(a.entry.object === preferredObject)
          || a.dot - b.dot || a.distance - b.distance);
      for (const candidate of candidates) {
        const dx = candidate.target.x - g.player.pos.x;
        const dz = candidate.target.z - g.player.pos.z;
        const horizontal = Math.max(0.001, Math.hypot(dx, dz));
        const eyeY = g.player.pos.y + 1.62;
        const baseYaw = Math.atan2(-dx, -dz);
        const basePitch = Math.max(-1.15, Math.min(1.15,
          Math.atan2(candidate.target.y - eyeY, horizontal)));
        g.player.yaw = baseYaw;
        g.player.pitch = basePitch;
        g.player._sync(0);
        g._updateReducedWorldFrustum();
        if (g._reducedPhysicalCandidate(candidate.entry.object)) {
          return { ...candidate, baseYaw, basePitch };
        }
      }
      return null;
    };
    const moveUntilPromotion = async (counter, label, preferredObject) => {
      const progress = g.currentGpuResidency.progressive;
      const before = progress[counter] || 0;
      const selected = faceOwnerCandidate(preferredObject);
      if (!selected) throw new Error(`no physically revealable ${label} owner candidate`);
      const startedAt = performance.now();
      let lastMoveAt = startedAt;
      let movements = 0;
      while ((progress[counter] || 0) === before && movements < 48) {
        // A small continuous look oscillation is enough to make this a real
        // moving-camera race without turning it into a synthetic teleport storm.
        g.player.yaw = selected.baseYaw + (movements % 2 ? 0.012 : -0.012);
        g.player.pitch = selected.basePitch;
        g.player._sync(0);
        lastMoveAt = performance.now();
        movements++;
        await frame();
      }
      if ((progress[counter] || 0) === before) {
        throw new Error(`${label} owner candidate was never promoted`);
      }
      const promotedAt = performance.now();
      const renderStart = renders.length;
      await waitFor(() => g.currentGpuResidency.physical.has(progress.key),
        `${label} exact physical reveal`, 2000);
      const firstFull = renders.slice(renderStart)
        .find((entry) => entry.drawCalls > 0 && !entry.reducedDetail) || null;
      return {
        object: selected.entry.object.uuid,
        movements,
        before,
        after: progress[counter] || 0,
        startedAt,
        lastMoveAt,
        promotedAt,
        fullAt: firstFull?.atMs || null,
        lastMoveToFullMs: firstFull ? firstFull.atMs - lastMoveAt : null,
        firstFull,
        frames: renders.filter((entry) => entry.atMs >= startedAt
          && (!firstFull || entry.atMs <= firstFull.atMs)),
      };
    };

    const initialProgress = g.currentGpuResidency.progressive;
    const coldProbeStart = Object.fromEntries(Object.entries(probes).map(([label, object]) => [label, {
      object: object.uuid,
      geometry: object.geometry.uuid,
      inCriticalQueue: initialProgress.queue.some((entry) => entry.object === object),
      inOwnerQueue: initialProgress.ownerQueue.some((entry) => entry.object === object),
      inUniverse: initialProgress.ownerUniverse.has(object.uuid),
      geometrySeen: initialProgress.geometrySeen.has(object.geometry.uuid),
    }]));
    const critical = await moveUntilPromotion(
      'criticalPromotedObjects', 'critical', probes.critical,
    );
    const progress = g.currentGpuResidency.progressive;
    await waitFor(() => g.currentGpuResidency.physical.has(progress.key)
      && progress.ownerQueue.length > 0, 'playable physical room with owner work pending');
    const owner = await moveUntilPromotion(
      'ownerPromotedObjects', 'owner-phase', probes.owner,
    );
    // The final owner batch must own its paint. Make the real mirror eligible
    // before the drain finishes; the following paint may certify, never the
    // final upload paint itself.
    g.houseMirror.awakened = true;
    g.player.pos.set(g.houseMirror.pos.x + 2.1, 0, g.houseMirror.pos.z);
    g.player.yaw = Math.PI / 2;
    g.player.pitch = 0;
    g.player._sync(0);
    await waitFor(() => progress.ownerQueue.length === 0 && progress.ownerRecorded,
      'complete house owner universe', 30000);
    const promotionChecksAtCompletion = progress.ownerPromotionChecks;
    const steadyFrames = [];
    for (let i = 0; i < 8; i++) {
      const start = renders.length;
      await frame();
      steadyFrames.push(renders[start] || null);
    }
    const promotionChecksAfterSteady = progress.ownerPromotionChecks;

    const sweepFrames = [];
    let sweepPreviousRaf = intervals.length;
    for (let turn = 0; turn < 4; turn++) {
      g.player.yaw = originalPose.yaw + turn * Math.PI / 2;
      g.player.pitch = originalPose.pitch;
      g.player._sync(0);
      const start = renders.length;
      await frame();
      sweepFrames.push(renders[start] || null);
    }
    const sweepIntervals = intervals.slice(sweepPreviousRaf);

    g.player.pos.copy(originalPose.pos);
    g.player.yaw = originalPose.yaw;
    g.player.pitch = originalPose.pitch;
    g.player._sync(0);
    await frame();
    sampling = false;
    g.render = realRender;
    g._cloneReducedRenderable = realCloneReduced;
    await frame();
    const universe = [...(g.currentGpuResidency?.ownerUniverses || [])]
      .find((entry) => entry.house > 0) || null;
    const expectedOwnerMembers = renderableIds([
      ...(g.staticWorldRenderRoots || []),
      ...(g.houseRenderRoots || []),
      ...(g.graveyardRenderRoots || []),
      g.atmosphere?.group,
      g.houseMirror?.double,
      g.houseMirror?.echo,
    ]);
    const coldProbeEnd = Object.fromEntries(Object.entries(probes).map(([label, object]) => [label, {
      object: object.uuid,
      geometry: object.geometry.uuid,
      processed: progress.processed.has(object.uuid),
      covered: progress.ownerCovered.has(object.uuid),
      geometrySeen: progress.geometrySeen.has(object.geometry.uuid),
    }]));
    const residency = g.currentGpuResidency;
    const savedProgress = residency.progressive;
    const savedKey = residency.activeKey;
    const savedErrorCount = residency.errors.length;
    const persistentProgress = g._makeReducedWorldProgress('persistent-hidden-owner-failure');
    persistentProgress.snapshotReady = true;
    persistentProgress.ownerUniverse.add(probes.ownerFailure.uuid);
    persistentProgress.ownerHouse.add(probes.ownerFailure.uuid);
    persistentProgress.ownerHouseGeometries.add(probes.ownerFailure.geometry.uuid);
    persistentProgress.ownerQueue.push({
      object: probes.ownerFailure,
      distance: Infinity,
      structural: 0,
      preloadOnly: true,
      preloadOwner: 'house',
    });
    persistentProgress.queued.add(probes.ownerFailure.uuid);
    residency.progressive = persistentProgress;
    residency.activeKey = persistentProgress.key;
    residency.physical.add(persistentProgress.key);
    const persistentRealClone = g._cloneReducedRenderable;
    g._cloneReducedRenderable = (object, options) => object === probes.ownerFailure
      ? null : persistentRealClone.call(g, object, options);
    const persistentAttempts = [
      g._submitReducedWorldBatch(persistentProgress, { ownerOnly: true }),
      g._submitReducedWorldBatch(persistentProgress, { ownerOnly: true }),
      g._submitReducedWorldBatch(persistentProgress, { ownerOnly: true }),
    ];
    const persistentRecorded = g._recordOwnerGpuUniverse(persistentProgress);
    const persistentPrerequisites = g._ownerGpuPrerequisitesReady('house');
    const persistentOwnerFailure = {
      attempts: persistentAttempts.map((attempt) => ({
        deferred: !!attempt?.deferred,
        failed: !!attempt?.failed,
        owner: attempt?.cloneFailure?.owner || null,
        permanent: !!attempt?.cloneFailure?.permanent,
      })),
      queue: persistentProgress.ownerQueue.length,
      failedObjects: [...persistentProgress.failedObjects],
      failedOwners: [...persistentProgress.failedOwners],
      total: persistentProgress.ownerUniverse.size,
      covered: persistentProgress.ownerCovered.size,
      ownerRecorded: !!persistentProgress.ownerRecorded,
      recordReturned: persistentRecorded,
      prerequisites: persistentPrerequisites,
      physicalStillReady: residency.physical.has(persistentProgress.key),
    };
    g._cloneReducedRenderable = persistentRealClone;
    residency.errors.splice(savedErrorCount);
    residency.physical.delete(persistentProgress.key);
    residency.progressive = savedProgress;
    residency.activeKey = savedKey;
    for (const probe of Object.values(probes)) {
      probe.removeFromParent();
      const rootIndex = g.houseRenderRoots.indexOf(probe);
      if (rootIndex >= 0) g.houseRenderRoots.splice(rootIndex, 1);
      probe.geometry.dispose();
    }
    return {
      critical,
      owner,
      reducedPasses: [...(g.currentGpuResidency?.reducedPasses || [])],
      exactPasses: [...(g.currentGpuResidency?.exactPasses || [])],
      ownerUniverses: [...(g.currentGpuResidency?.ownerUniverses || [])],
      universe,
      expectedOwnerMembers,
      coldProbeStart,
      coldProbeEnd,
      cloneFailureHits,
      cloneFailureEvents: [...progress.cloneFailureEvents],
      persistentOwnerFailure,
      ownerProgressFrames: renders.filter((frame) => frame.ownerProgress),
      ownerCertificationFrames: renders.filter((frame) => frame.ownerPassDelta > 0),
      promotionChecksAtCompletion,
      promotionChecksAfterSteady,
      steadyFrames,
      sweepFrames,
      sweepMaxRafMs: Math.max(0, ...sweepIntervals),
      maxRafMs: Math.max(0, ...intervals),
      maxRenderMs: Math.max(0, ...renders.map((entry) => entry.ms)),
      errors: [...(g.currentGpuResidency?.errors || [])],
    };
  });
  for (const movement of [value.critical, value.owner]) {
    movement.lastMoveToFullMs = round(movement.lastMoveToFullMs);
    if (movement.firstFull) movement.firstFull.ms = round(movement.firstFull.ms);
    for (const frame of movement.frames) frame.ms = round(frame.ms);
  }
  value.sweepMaxRafMs = round(value.sweepMaxRafMs);
  value.maxRafMs = round(value.maxRafMs);
  value.maxRenderMs = round(value.maxRenderMs);
  for (const frame of value.sweepFrames) if (frame) frame.ms = round(frame.ms);
  report.browserErrors.push(...opened.errors.map((error) => `continuous-view: ${error}`));
  await page.close();
  return value;
}

async function runDeferredDistrictResidency(browser) {
  const opened = await openPage(browser, report.url);
  const { page } = opened;
  await ready(page);
  const value = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    const realRender = g.render;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const waitFor = async (predicate, label, timeout = 90000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) await frame();
      if (!predicate()) throw new Error(`timed out waiting for ${label}`);
    };
    const renderableIds = (roots) => {
      const ids = new Set();
      for (const root of roots || []) root?.traverse((object) => {
        if ((object.isMesh || object.isLine || object.isPoints)
            && object.geometry && object.material) ids.add(object.uuid);
      });
      return [...ids].sort();
    };
    const hasVisibleAncestors = (object) => {
      let ancestor = object;
      while (ancestor && ancestor !== g.scene) {
        if (ancestor.visible === false) return false;
        ancestor = ancestor.parent;
      }
      return ancestor === g.scene;
    };
    const findBaseMesh = (roots) => {
      let base = null;
      for (const root of roots || []) root?.traverse((object) => {
        if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh
            || !object.geometry?.attributes?.position || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (!materials.some((material) => material?.visible !== false
            && (!material.transparent || (material.opacity ?? 1) > 0.001))) return;
        if (!base || object.geometry.attributes.position.count
            < base.geometry.attributes.position.count) base = object;
      });
      return base;
    };

    g.render = () => {};
    F.start();
    g._selfStep = false;
    await waitFor(() => g.shaderWarmup?.status === 'ready', 'predictive warmup');
    const cases = [];

    const districtCases = [
      { act: 'graveyard', rootKind: 'forest-lookahead' },
      { act: 'forest', rootKind: 'clearing-lookahead' },
      { act: 'cave', rootKind: 'cave' },
    ];
    for (const { act, rootKind } of districtCases) {
      g.render = () => {};
      if (act === 'cave' && !g.flags.has('waterfallTaken')) {
        g.director.waterfallTaken();
        g.skull.vanish();
      }
      F.teleport(act);
      g._selfStep = false;
      if (act === 'graveyard') {
        // Forest detail intentionally wakes before the act switch as the player
        // approaches the still-graveyard side of the gate.
        g.player.pos.x = 2;
        g.player.pos.z = 33;
        g.player.pos.y = g.world.groundHeightAt(2, 33, 3);
        g.player._sync(0);
      }
      F.stepWith(1 / 120, {}, false);
      const district = g._currentDeferredGpuRoots();
      const grave = new Set(g.graveyardRenderRoots || []);
      const forest = new Set(g.forest?.detailRoots || []);
      const cave = new Set(g.underfalls?.renderRoots || []);
      const clearingRoots = (g.outsideRenderRoots || []).filter((root) =>
        !grave.has(root) && !forest.has(root) && !cave.has(root));
      const authoredRoots = rootKind === 'forest-lookahead'
        ? g.forest.detailRoots
        : rootKind === 'clearing-lookahead' ? g.outsideRenderRoots : g.underfalls.renderRoots;
      const sourceRoots = rootKind === 'forest-lookahead'
        ? g.forest.detailRoots
        : rootKind === 'clearing-lookahead' ? clearingRoots : g.underfalls.renderRoots;
      const base = findBaseMesh(sourceRoots);
      if (!base) throw new Error(`no simple ${act} mesh for deferred-view probe`);
      const originalPose = {
        pos: g.player.pos.clone(), yaw: g.player.yaw, pitch: g.player.pitch,
      };
      const probe = base.clone(false);
      probe.name = `${act} deferred cold turn probe`;
      probe.geometry = base.geometry.clone();
      probe.material = base.material;
      probe.visible = true;
      probe.frustumCulled = true;
      probe.castShadow = false;
      probe.receiveShadow = false;
      probe.layers.set(0);
      // The first view cannot see this. It is nevertheless a member of the
      // explicit authored district universe and must remain cold until the turn.
      probe.position.set(
        originalPose.pos.x + Math.sin(originalPose.yaw) * 4.2,
        originalPose.pos.y + 1.15,
        originalPose.pos.z + Math.cos(originalPose.yaw) * 4.2,
      );
      // Authored merged geometries can have an object-space sphere whose center
      // is metres from the mesh origin. This probe owns a private clone, so put
      // its bounds at the authored test position before normalising its radius;
      // otherwise looking straight at the object can honestly miss its offset
      // bounding sphere and counterfeit a failed camera-promotion scenario.
      probe.geometry.center();
      probe.geometry.computeBoundingSphere();
      const probeRadius = Math.max(0.001, probe.geometry.boundingSphere?.radius || 1);
      // Normalize arbitrary authored source geometry to a compact 24cm test
      // target. A giant low-vertex wall must not leak into the initial frustum
      // merely because it happened to win the base-mesh search.
      probe.scale.setScalar(0.24 / probeRadius);
      g.scene.add(probe);
      authoredRoots.push(probe);

      const renders = [];
      const intervals = [];
      let previousRaf = null;
      let sampling = true;
      const sampleRaf = () => {
        const observedAt = performance.now();
        if (previousRaf != null) intervals.push(observedAt - previousRaf);
        previousRaf = observedAt;
        if (sampling) requestAnimationFrame(sampleRaf);
      };
      requestAnimationFrame(sampleRaf);
      g._resetCurrentGpuResidency(`${act}-deferred-camera-adversary`);
      g.render = function measuredDeferredRender(...args) {
        const before = {
          programs: g.renderer.info.programs?.length || 0,
          textures: g.renderer.info.memory.textures,
          geometries: g.renderer.info.memory.geometries,
        };
        const startedAt = performance.now();
        try { return realRender.apply(this, args); }
        finally {
          const progress = g.currentGpuResidency?.progressive;
          renders.push({
            atMs: performance.now(),
            ms: performance.now() - startedAt,
            drawCalls: g.lastRender?.drawCalls || 0,
            reducedDetail: !!g.lastRender?.reducedDetail,
            deferredProgress: !!g.lastRender?.deferredProgress,
            visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
            visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
            visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
            rawProgramDelta: (g.renderer.info.programs?.length || 0) - before.programs,
            rawTextureDelta: g.renderer.info.memory.textures - before.textures,
            rawGeometryDelta: g.renderer.info.memory.geometries - before.geometries,
            physical: g.currentGpuResidency?.physical?.has(progress?.key) || false,
            queue: progress?.queue?.length || 0,
            deferredQueue: progress?.deferredQueue?.length || 0,
            deferredPromotionChecks: progress?.deferredPromotionChecks || 0,
            deferredPromotedObjects: progress?.deferredPromotedObjects || 0,
          });
        }
      };

      await waitFor(() => {
        const progress = g.currentGpuResidency?.progressive;
        return progress?.snapshotReady && g.currentGpuResidency.physical.has(progress.key);
      }, `${act} first exact physical view`, 30000);
      const progress = g.currentGpuResidency.progressive;
      const expectedMembers = renderableIds(g._currentDeferredGpuRoots().roots);
      const coldStart = {
        object: probe.uuid,
        geometry: probe.geometry.uuid,
        inUniverse: progress.deferredUniverse.has(probe.uuid),
        inDeferredQueue: progress.deferredQueue.some((entry) => entry.object === probe),
        processed: progress.processed.has(probe.uuid),
        geometrySeen: progress.geometrySeen.has(probe.geometry.uuid),
        deferredQueue: progress.deferredQueue.length,
      };
      if (!hasVisibleAncestors(probe)) throw new Error(`${act} probe ancestry is hidden`);
      const target = probe.getWorldPosition(g.player.pos.clone());
      const dx = target.x - g.player.pos.x;
      const dz = target.z - g.player.pos.z;
      const horizontal = Math.max(0.001, Math.hypot(dx, dz));
      const lookYaw = Math.atan2(-dx, -dz);
      const lookPitch = Math.max(-1.15, Math.min(1.15,
        Math.atan2(target.y - (g.player.pos.y + 1.62), horizontal)));
      const promotionBefore = progress.deferredPromotedObjects;
      const moveStartedAt = performance.now();
      g.player.pos.x += dx / horizontal * 0.28;
      g.player.pos.z += dz / horizontal * 0.28;
      g.player.yaw = lookYaw;
      g.player.pitch = lookPitch;
      g.player._sync(0);
      g._updateReducedWorldFrustum();
      if (!g._reducedPhysicalCandidate(probe)) {
        const materials = Array.isArray(probe.material) ? probe.material : [probe.material];
        const center = probe.geometry.boundingSphere?.center.clone()
          .applyMatrix4(probe.matrixWorld).toArray();
        throw new Error(`${act} cold probe did not enter the moved camera frustum: ${JSON.stringify({
          layerMask: probe.layers.mask,
          ancestorsVisible: hasVisibleAncestors(probe),
          materialRenderable: materials.some((material) => material?.visible !== false
            && (!material.transparent || (material.opacity ?? 1) > 0.001)),
          objectPosition: probe.getWorldPosition(g.player.pos.clone()).toArray(),
          boundingCenter: center,
          boundingRadius: probe.geometry.boundingSphere?.radius * probe.scale.x,
          cameraPosition: g.camera.getWorldPosition(g.player.pos.clone()).toArray(),
          yaw: g.player.yaw,
          pitch: g.player.pitch,
        })}`);
      }
      const movementRenderStart = renders.length;
      await frame();
      await waitFor(() => progress.deferredPromotedObjects > promotionBefore,
        `${act} deferred promotion`, 2000);
      await waitFor(() => g.currentGpuResidency.physical.has(progress.key),
        `${act} exact reveal after turn`, 2000);
      const movementFrames = renders.slice(movementRenderStart);
      const firstFull = movementFrames.find((entry) => entry.drawCalls > 0
        && !entry.reducedDetail) || null;
      const firstFullAt = firstFull?.atMs || null;
      const framesThroughFull = movementFrames.filter((entry) =>
        firstFullAt == null || entry.atMs <= firstFullAt);
      const coldEnd = {
        processed: progress.processed.has(probe.uuid),
        covered: progress.deferredCovered.has(probe.uuid),
        geometrySeen: progress.geometrySeen.has(probe.geometry.uuid),
      };
      const deferredPassesAtReveal = [...g.currentGpuResidency.reducedPasses];
      const exactPassesAtReveal = [...g.currentGpuResidency.exactPasses];
      const queueAtFirstFull = firstFull?.deferredQueue ?? null;

      await waitFor(() => progress.deferredQueue.length === 0
        && progress.deferredRecorded, `${act} deferred universe drain`, 30000);
      const universe = [...g.currentGpuResidency.deferredUniverses]
        .find((entry) => entry.label === act) || null;
      const promotionChecksAtCompletion = progress.deferredPromotionChecks;
      const steadyFrames = [];
      for (let i = 0; i < 8; i++) {
        const start = renders.length;
        await frame();
        steadyFrames.push(renders[start] || null);
      }
      const promotionChecksAfterSteady = progress.deferredPromotionChecks;
      const sweepFrames = [];
      const sweepIntervalStart = intervals.length;
      for (let turn = 0; turn < 4; turn++) {
        g.player.yaw = lookYaw + turn * Math.PI / 2;
        g.player.pitch = lookPitch;
        g.player._sync(0);
        const start = renders.length;
        await frame();
        sweepFrames.push(renders[start] || null);
      }
      const sweepIntervals = intervals.slice(sweepIntervalStart);
      let transactionalFault = null;
      if (act === 'forest') {
        const residency = g.currentGpuResidency;
        const savedProgress = residency.progressive;
        const savedKey = residency.activeKey;
        const savedErrors = residency.errors.length;
        const savedPasses = residency.reducedPasses.length;
        const savedUniverses = residency.deferredUniverses.length;
        const faultObject = base.clone(false);
        faultObject.name = 'deferred transactional render fault probe';
        faultObject.geometry = base.geometry.clone();
        faultObject.material = base.material;
        faultObject.visible = true;
        faultObject.layers.set(0);
        const faultProgress = g._makeReducedWorldProgress('deferred-transaction-fault');
        faultProgress.snapshotReady = true;
        faultProgress.deferredLabel = 'forest-fault';
        faultProgress.deferredUniverse.add(faultObject.uuid);
        faultProgress.deferredGeometries.add(faultObject.geometry.uuid);
        faultProgress.deferredQueue.push({
          object: faultObject,
          distance: Infinity,
          structural: 0,
          preloadOnly: true,
          preloadOwner: null,
          preloadDeferred: 'forest-fault',
        });
        faultProgress.queued.add(faultObject.uuid);
        residency.progressive = faultProgress;
        residency.activeKey = faultProgress.key;
        residency.physical.add(faultProgress.key);
        const realRendererRender = g.renderer.render;
        let inject = true;
        g.renderer.render = function injectedDeferredRenderFault(scene, ...args) {
          if (inject && scene === faultProgress.scene) {
            inject = false;
            throw new Error('injected deferred transactional render fault');
          }
          return realRendererRender.call(this, scene, ...args);
        };
        const first = g._submitReducedWorldBatch(faultProgress, { deferredOnly: true });
        const afterFault = {
          returned: first,
          queue: faultProgress.deferredQueue.length,
          processed: faultProgress.processed.has(faultObject.uuid),
          covered: faultProgress.deferredCovered.has(faultObject.uuid),
          geometrySeen: faultProgress.geometrySeen.has(faultObject.geometry.uuid),
          recorded: g._recordDeferredGpuUniverse(faultProgress),
        };
        g.renderer.render = realRendererRender;
        const retry = g._submitReducedWorldBatch(faultProgress, { deferredOnly: true });
        const recorded = g._recordDeferredGpuUniverse(faultProgress);
        transactionalFault = {
          afterFault,
          retry: retry ? {
            error: retry.error,
            objects: retry.objects,
            geometries: retry.geometries,
            geometryDelta: retry.geometryDelta,
          } : null,
          afterRetry: {
            queue: faultProgress.deferredQueue.length,
            processed: faultProgress.processed.has(faultObject.uuid),
            covered: faultProgress.deferredCovered.has(faultObject.uuid),
            geometrySeen: faultProgress.geometrySeen.has(faultObject.geometry.uuid),
            recorded,
          },
        };
        residency.physical.delete(faultProgress.key);
        residency.progressive = savedProgress;
        residency.activeKey = savedKey;
        residency.errors.splice(savedErrors);
        residency.reducedPasses.splice(savedPasses);
        residency.deferredUniverses.splice(savedUniverses);
        faultObject.geometry.dispose();
      }
      sampling = false;
      g.render = () => {};
      const rootIndex = authoredRoots.indexOf(probe);
      if (rootIndex >= 0) authoredRoots.splice(rootIndex, 1);
      probe.removeFromParent();
      probe.geometry.dispose();
      cases.push({
        act,
        rootKind,
        expectedMembers,
        coldStart,
        coldEnd,
        moveToFullMs: firstFull ? firstFull.atMs - moveStartedAt : null,
        queueAtFirstFull,
        movementFrames: framesThroughFull,
        firstFull,
        deferredPassesAtReveal,
        exactPassesAtReveal,
        allReducedPasses: [...g.currentGpuResidency.reducedPasses],
        universe,
        deferredFullFrames: g.currentGpuResidency.deferredFullFrames,
        promotionChecksAtCompletion,
        promotionChecksAfterSteady,
        steadyFrames,
        sweepFrames,
        transactionalFault,
        sweepMaxRafMs: Math.max(0, ...sweepIntervals),
        maxRafMs: Math.max(0, ...intervals),
        maxRenderMs: Math.max(0, ...renders.map((entry) => entry.ms)),
        errors: [...g.currentGpuResidency.errors],
      });
    }
    g.render = realRender;
    await frame();
    return cases;
  });
  for (const entry of value) {
    for (const key of ['moveToFullMs', 'sweepMaxRafMs', 'maxRafMs', 'maxRenderMs']) {
      entry[key] = round(entry[key]);
    }
    for (const frame of [
      ...(entry.movementFrames || []), ...(entry.steadyFrames || []),
      ...(entry.sweepFrames || []),
    ]) if (frame) frame.ms = round(frame.ms);
  }
  report.browserErrors.push(...opened.errors.map((error) => `deferred-districts: ${error}`));
  await page.close();
  return value;
}

async function runPurityAndSettled(browser) {
  // Chrome itself is launched muted, but FETCH's AudioContext remains live so
  // an accidental synthetic Choir call/loop is observable in engine state.
  const opened = await openPage(browser, report.audioPurityUrl);
  const { page } = opened;
  await ready(page);
  const purity = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    const state = () => ({
      act: g.act,
      player: [g.player.pos.x, g.player.pos.y, g.player.pos.z, g.player.yaw, g.player.pitch],
      flags: [...g.flags].sort(),
      enemies: g.enemies.list.map((enemy) => ({
        uuid: enemy.mesh.uuid, kind: enemy.kind, state: enemy.state,
        parent: enemy.mesh.parent?.uuid || null,
      })),
      choir: g.enemies.choir?.mesh?.uuid || null,
      spawnSerial: g.enemies._spawnSerial,
      spawnLog: JSON.stringify(g.spawnLog || []),
      audioReady: g.audio.ready,
      audioLoops: [...(g.audio._loops || [])].map((loop) => loop?.source?.constructor?.name || 'loop').sort(),
      forestLoops: g.audio._forestStoryLoops?.size || 0,
      audioZone: g.audio._zone,
      skullStage: g.skull.stage,
      skullMode: g.skull.mode,
      skullParent: g.skull.root.parent?.uuid || null,
      exactHead: g.finale.figure.userData.exactHead?.uuid || null,
      headChildren: g.finale.figure.userData.headMount.children.map((child) => child.uuid),
      figureVisible: g.finale.figure.visible,
      finaleActive: g.finale.active,
      finalePhase: g.finale.phase,
      contextRewarming: g.finale._contextRewarming,
      rendererTarget: g.renderer.getRenderTarget()?.texture?.uuid || null,
      sceneParents: g.scene.children.map((child) => `${child.uuid}:${child.parent?.uuid || ''}`).sort(),
    });
    const skullFlightState = () => ({
      mode: g.skull.mode,
      parent: g.skull.root.parent?.uuid || null,
      position: g.skull.pos.toArray(),
      previous: g.skull.prevPos.toArray(),
      velocity: g.skull.vel.toArray(),
      flightTime: g.skull.flightTime,
      freeFlightTime: g.skull.freeFlightTime,
      outboundDuration: g.skull.outboundDuration,
      hardAway: g.skull.hardAway,
      maxRange: g.skull.maxRange,
      returnTime: g.skull.returnTime,
      returnStuck: g.skull.returnStuck,
      returnSide: g.skull.returnSide,
      stage: g.skull.stage,
      pendingStage: g.skull.pendingStage,
      carry: g.skull.carry?.id || null,
      nodes: (() => {
        const nodes = [];
        g.skull.root.traverse((object) => {
          if (!object.isLight) nodes.push({
            uuid: object.uuid,
            visible: object.visible,
            frustumCulled: object.frustumCulled,
            layerMask: object.layers.mask,
          });
        });
        return nodes;
      })(),
      tether: {
        visible: g.skull.tether.visible,
        opacity: g.skull.tether.material.opacity,
        frustumCulled: g.skull.tether.frustumCulled,
        layerMask: g.skull.tether.layers.mask,
      },
    });
    const skullResidencyState = () => {
      const nodes = [];
      g.skull.root.traverse((object) => {
        if (object.isLight) return;
        // These zero-scale carried-flame representatives deliberately retire
        // after the first delivered world+held frame. Normalize only that one
        // intentional visibility edge; parent, layer and culling state remain
        // in the purity contract so the exact prime cannot hide a real leak.
        const carriedPrime = /^carried-flame-/.test(object.name || '');
        nodes.push({
          uuid: object.uuid,
          name: object.name || null,
          visible: carriedPrime ? 'intentional-retirement' : object.visible,
          frustumCulled: object.frustumCulled,
          layerMask: object.layers.mask,
          parent: object.parent?.uuid || null,
        });
      });
      const tether = g.skull.tether;
      return {
        nodes,
        tether: tether ? {
          uuid: tether.uuid,
          visible: tether.visible,
          frustumCulled: tether.frustumCulled,
          layerMask: tether.layers.mask,
          opacity: tether.material?.opacity,
          parent: tether.parent?.uuid || null,
        } : null,
      };
    };
    const intervals = [];
    const purityRenders = [];
    const slowPurityRenders = [];
    const slowPurityObserved = [];
    const orderingErrors = [];
    const finalizerFrames = [];
    const seenFinalizers = new WeakSet();
    let frameSerial = 0;
    let lastCompletedRender = null;
    const realRender = g.render;
    g.render = function measuredPurityRender(...args) {
      const residencyBefore = g.currentGpuResidency;
      const passCountsBefore = {
        reduced: residencyBefore?.reducedPasses?.length || 0,
        exact: residencyBefore?.exactPasses?.length || 0,
        exactPreload: residencyBefore?.exactPreloadPasses?.length || 0,
        owner: residencyBefore?.ownerPasses?.length || 0,
        finalizer: residencyBefore?.universeFinalizePasses?.length || 0,
      };
      const shaderBefore = {
        status: g.shaderWarmup?.status || null,
        inFlight: g._shaderCompileActivity?.active || 0,
        inFlightLabel: g.shaderWarmup?.compileInFlightLabel || null,
        jobs: g.shaderWarmup?.compileJobs?.length || 0,
      };
      const renderStartedAt = performance.now();
      try { return realRender.apply(this, args); }
      finally {
        const renderCompletedAt = performance.now();
        const residencyAfter = g.currentGpuResidency;
        const row = {
          frameId: ++frameSerial,
          generation: g._webglGeneration,
          key: g.currentGpuResidency?.progressive?.key || null,
          startedAt: renderStartedAt,
          completedAt: renderCompletedAt,
          ms: renderCompletedAt - renderStartedAt,
          drawCalls: g.lastRender?.drawCalls || 0,
          worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
          heldDrawCalls: g.lastRender?.heldDrawCalls || 0,
          reducedDetail: !!g.lastRender?.reducedDetail,
          residencyKey: g.lastRender?.residencyKey || null,
          bootstrapKind: g.lastRender?.bootstrapKind || null,
          snapshotProgress: !!g.lastRender?.snapshotProgress,
          reducedBatchSubmitted: !!g.lastRender?.reducedBatchSubmitted,
          reducedBatchRevealed: !!g.lastRender?.reducedBatchRevealed,
          ownerProgress: !!g.lastRender?.ownerProgress,
          deferredProgress: !!g.lastRender?.deferredProgress,
          ownerExactProgress: !!g.lastRender?.ownerExactProgress,
          deferredExactProgress: !!g.lastRender?.deferredExactProgress,
          visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
          visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
          visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
          passRanges: {
            reduced: [passCountsBefore.reduced, residencyAfter?.reducedPasses?.length || 0],
            exact: [passCountsBefore.exact, residencyAfter?.exactPasses?.length || 0],
            exactPreload: [passCountsBefore.exactPreload,
              residencyAfter?.exactPreloadPasses?.length || 0],
            owner: [passCountsBefore.owner, residencyAfter?.ownerPasses?.length || 0],
            finalizer: [passCountsBefore.finalizer,
              residencyAfter?.universeFinalizePasses?.length || 0],
          },
          shaderBefore,
          shaderAfter: {
            status: g.shaderWarmup?.status || null,
            inFlight: g._shaderCompileActivity?.active || 0,
            inFlightLabel: g.shaderWarmup?.compileInFlightLabel || null,
            jobs: g.shaderWarmup?.compileJobs?.length || 0,
          },
        };
        purityRenders.push(row);
        if (row.ms >= 80 && slowPurityRenders.length < 16) {
          slowPurityRenders.push(row);
        }
        lastCompletedRender = row;
        for (const entry of g.currentGpuResidency?.universeFinalizePasses || []) {
          if (seenFinalizers.has(entry)) continue;
          seenFinalizers.add(entry);
          finalizerFrames.push({
            ...entry,
            frameId: row.frameId,
            renderGeneration: row.generation,
            renderKey: row.key,
            renderMs: row.ms,
            worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
            drawCalls: g.lastRender?.drawCalls || 0,
            reducedDetail: !!g.lastRender?.reducedDetail,
          });
        }
      }
    };
    let previous = null;
    let sampling = true;
    const raf = () => {
      if (!sampling) return;
      const observedAt = performance.now();
      const completed = lastCompletedRender;
      if (completed) {
        if (previous) {
          const ordered = completed.frameId > previous.frameId
            && completed.completedAt <= observedAt
            && previous.completedAt <= previous.observedAt;
          if (ordered) {
            const durationMs = observedAt - previous.observedAt;
            intervals.push(durationMs);
            if (durationMs >= 80 && slowPurityObserved.length < 16) {
              slowPurityObserved.push({
                durationMs,
                previous: {
                  frameId: previous.frameId,
                  startedAt: previous.startedAt,
                  completedAt: previous.completedAt,
                  observedAt: previous.observedAt,
                },
                current: {
                  frameId: completed.frameId,
                  startedAt: completed.startedAt,
                  completedAt: completed.completedAt,
                  observedAt,
                },
              });
            }
          }
          else if (orderingErrors.length < 16) {
            orderingErrors.push({ previous, current: { ...completed, observedAt } });
          }
        }
        previous = { ...completed, observedAt };
      }
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const beforeSkullResidency = skullResidencyState();
    const audioPreparation = {
      contextExists: !!g.audio.ctx,
      contextState: g.audio.ctx?.state || null,
      graphInitialized: !!g.audio._graphInitialized,
      masterExists: !!g.audio.master,
      startupSourcesStarted: !!g.audio._startupSourcesStarted,
      ready: g.audio.ready,
      status: g.audio.startupBake?.status || null,
      prepareCalls: g.audio.startupBake?.prepareCalls ?? null,
      contextPrepareStartedAt: g.audio.startupBake?.contextPrepareStartedAt ?? null,
      contextPrepareReadyAt: g.audio.startupBake?.contextPrepareReadyAt ?? null,
      contextCreatedAt: g.audio.startupBake?.contextCreatedAt ?? null,
      contextPrepareMs: g.audio.startupBake?.contextPrepareMs ?? null,
      contextPrepareError: g.audio.startupBake?.contextPrepareError ?? null,
    };
    const audioInitCalls = [];
    const realAudioInit = g.audio.init;
    g.audio.init = function measuredAudioInit(...args) {
      const audioStartedAt = performance.now();
      try { return realAudioInit.apply(this, args); }
      finally {
        const audioCompletedAt = performance.now();
        audioInitCalls.push({
          startedAt: audioStartedAt,
          completedAt: audioCompletedAt,
          durationMs: audioCompletedAt - audioStartedAt,
        });
      }
    };
    // Keep deterministic gameplay time frozen before the Wake transaction.
    // Test-mode rAF still renders every frame, so audio/GPU background work is
    // measured without advancing Director timers, enemy age or story state.
    g._selfStep = false;
    const startedAt = performance.now();
    F.start();
    const startMs = performance.now() - startedAt;
    // startGame synchronously resumes the prepared context and initializes the
    // silent graph before pointer lock. This continuation still precedes every
    // post-paint PCM slice.
    await Promise.resolve();
    const wakeTaskMs = performance.now() - startedAt;
    g.audio.init = realAudioInit;
    const afterStart = state();
    const compactAudioStartup = () => {
      const startup = g.audio.startupBake;
      return startup ? {
        status: startup.status,
        prepareCalls: startup.prepareCalls,
        initCalls: startup.initCalls,
        resumeCalls: startup.resumeCalls,
        contextPrepareStartedAt: startup.contextPrepareStartedAt,
        contextPrepareReadyAt: startup.contextPrepareReadyAt,
        contextPrepareMs: startup.contextPrepareMs,
        contextPrepareError: startup.contextPrepareError,
        requestedAt: startup.requestedAt,
        contextCreatedAt: startup.contextCreatedAt,
        startedAt: startup.startedAt,
        readyAt: startup.readyAt,
        durationMs: startup.durationMs,
        totalLatencyMs: startup.totalLatencyMs,
        sliceBudgetMs: startup.sliceBudgetMs,
        primitiveLimit: startup.primitiveLimit,
        pcmChunkSamples: startup.pcmChunkSamples,
        sliceTelemetryLimit: startup.sliceTelemetryLimit,
        slices: (startup.slices || []).map((slice) => ({
          index: slice.index,
          scheduler: slice.scheduler,
          durationMs: slice.durationMs,
          primitiveCount: slice.primitiveCount,
          maxPrimitiveMs: slice.maxPrimitiveMs,
          labels: [...(slice.labels || [])],
          remaining: slice.remaining,
        })),
        maxSliceMs: startup.maxSliceMs,
        maxPrimitiveMs: startup.maxPrimitiveMs,
        completed: startup.completed,
        totalPrimitives: startup.totalPrimitives,
        pending: startup.pending,
        droppedSlices: startup.droppedSlices,
        scheduler: startup.scheduler,
        contextState: startup.contextState,
        resumeError: startup.resumeError,
        cancelReason: startup.cancelReason,
        error: startup.error,
      } : null;
    };
    const audioProgressSignature = () => {
      const startup = g.audio.startupBake;
      const lastSlice = startup?.slices?.at(-1);
      return JSON.stringify([
        g.audio.ready, startup?.status, startup?.initCalls,
        startup?.slices?.length, startup?.completed, startup?.totalPrimitives,
        startup?.pending, startup?.droppedSlices, startup?.scheduler,
        lastSlice?.index, lastSlice?.labels?.join('|'), lastSlice?.remaining,
        startup?.cancelReason, startup?.error,
      ]);
    };
    const audioHardDeadline = performance.now() + 5000;
    let audioProgressDeadline = performance.now() + 1000;
    let audioSignature = audioProgressSignature();
    while (!g.audio.ready && performance.now() < audioHardDeadline) {
      const startup = g.audio.startupBake;
      if (!startup || ['failed', 'cancelled'].includes(startup.status)) {
        throw new Error(`purity audio startup entered a terminal state: ${JSON.stringify(compactAudioStartup())}`);
      }
      const nextSignature = audioProgressSignature();
      if (nextSignature !== audioSignature) {
        audioSignature = nextSignature;
        audioProgressDeadline = performance.now() + 1000;
      } else if (performance.now() >= audioProgressDeadline) {
        throw new Error(`purity audio startup made no progress: ${JSON.stringify(compactAudioStartup())}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (!g.audio.ready || g.audio.startupBake?.status !== 'ready') {
      throw new Error(`purity audio startup exceeded 5s: ${JSON.stringify(compactAudioStartup())}`);
    }
    const afterAudio = state();
    const audioStartup = compactAudioStartup();
    const audioResources = {
      startupSourcesStarted: !!g.audio._startupSourcesStarted,
      contextSampleRate: g.audio.ctx?.sampleRate || 0,
      impulseBuffers: Object.fromEntries(Object.entries(g.audio._convolvers || {})
        .map(([kind, convolver]) => [kind, convolver.buffer ? {
          channels: convolver.buffer.numberOfChannels,
          length: convolver.buffer.length,
          sampleRate: convolver.buffer.sampleRate,
        } : null])),
      noiseSamples: g.audio._noiseBuf?.length || 0,
      cricketSamples: g.audio._crickLoop?.length || 0,
      woodSteps: g.audio._steps?.wood?.length || 0,
      stoneSteps: g.audio._steps?.stone?.length || 0,
      dirtSteps: g.audio._steps?.dirt?.length || 0,
      leafSteps: g.audio._steps?.leaves?.length || 0,
    };
    const warmupGeneration = g._webglGeneration;
    const warmupProgressSignature = () => {
      const shader = g.shaderWarmup;
      const activity = g._shaderCompileActivity;
      const lastJob = shader?.compileJobs?.at(-1);
      return JSON.stringify([
        g._webglGeneration, shader?.generation, shader?.status, shader?.reason,
        shader?.recoveryRound, shader?.recoveryScheduled,
        shader?.setupSlices?.length, shader?.compileSlices?.length,
        shader?.textureSlices?.length, shader?.compileJobs?.length,
        shader?.compileInFlightLabel, shader?.compileJobsInFlight,
        lastJob?.label, lastJob?.settledMs, lastJob?.error,
        activity?.generation, activity?.active,
        shader?.currentExactKey, shader?.currentExactRevision,
        shader?.currentExactStatus, (shader?.readyVariants || []).join('|'),
      ]);
    };
    const warmupHardDeadline = performance.now() + 240000;
    let warmupProgressDeadline = performance.now() + 30000;
    let warmupSignature = warmupProgressSignature();
    while (g.shaderWarmup?.status !== 'ready'
        && performance.now() < warmupHardDeadline) {
      const shader = g.shaderWarmup;
      if (!shader || g._webglGeneration !== warmupGeneration
          || shader.generation !== warmupGeneration || shader.status === 'invalidated'
          || shader.status === 'skipped'
          || (shader.status === 'degraded' && !shader.recoveryScheduled)) {
        throw new Error(`purity shader warmup entered a terminal state: ${JSON.stringify({
          generation: g._webglGeneration,
          status: shader?.status || null,
          shaderGeneration: shader?.generation ?? null,
          reason: shader?.reason || null,
          errors: [...(shader?.errors || [])],
        })}`);
      }
      const nextSignature = warmupProgressSignature();
      if (nextSignature !== warmupSignature) {
        warmupSignature = nextSignature;
        warmupProgressDeadline = performance.now() + 30000;
      } else if (performance.now() >= warmupProgressDeadline) {
        throw new Error(`purity shader warmup made no progress: ${warmupSignature}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (g.shaderWarmup?.status !== 'ready') {
      throw new Error(`purity shader warmup exceeded 240s: ${warmupProgressSignature()}`);
    }
    // Mirror-universe uploads are explicitly non-blocking for the physical
    // room. Let the background phase finish so its complete membership can be
    // inspected without conflating that wait with Wake/first-world timing.
    const ownerComplete = () => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const key = g._currentGpuResidencyKey();
      return residency?.generation === g._webglGeneration
        && residency.activeKey === key && progress?.key === key
        && progress.ownerQueue.length === 0 && progress.ownerExactQueue.length === 0
        && progress.ownerRecorded && progress.ownerExactRecorded
        && !progress.ownerFinalizeBlocked
        && (residency.ownerUniverses || []).some((entry) => entry.key === key && entry.house > 0)
        && (residency.universeFinalizePasses || []).some((entry) =>
          entry.key === key && entry.scope === 'owner' && entry.recorded && entry.error == null);
    };
    const ownerDeadline = performance.now() + 30000;
    while (!ownerComplete() && performance.now() < ownerDeadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    if (!ownerComplete()) throw new Error('house owner universe did not finalize cleanly');
    const afterWarm = state();
    sampling = false;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    g.render = realRender;
    return {
      startMs,
      wakeTaskMs,
      audioInitCalls,
      audioPreparation,
      afterStart,
      afterAudio,
      afterWarm,
      audioStartup,
      audioResources,
      beforeSkullResidency,
      afterSkullResidency: skullResidencyState(),
      intervals,
      timing: {
        renderCount: purityRenders.length,
        rafIntervals: intervals.length,
        orderingErrors,
        slowRenders: slowPurityRenders,
        slowObserved: slowPurityObserved,
        maxRenderMs: Math.max(0, ...purityRenders.map((row) => row.ms)),
        maxRenderStartIntervalMs: Math.max(0, ...purityRenders.slice(1)
          .map((row, index) => row.startedAt - purityRenders[index].startedAt)),
        maxInterRenderIdleMs: Math.max(0, ...purityRenders.slice(1)
          .map((row, index) => row.startedAt - purityRenders[index].completedAt)),
        maxRenderCompletionIntervalMs: Math.max(0, ...purityRenders.slice(1)
          .map((row, index) => row.completedAt - purityRenders[index].completedAt)),
      },
      warmup: { ...g.shaderWarmup },
      targetWarm: g.finale._targetWarmState ? {
        status: g.finale._targetWarmState.status,
        warmed: g.finale._targetWarmState.warmed,
        maxSliceMs: g.finale._targetWarmState.maxSliceMs,
        errors: [...g.finale._targetWarmState.errors],
      } : null,
      residency: {
        physical: [...(g.currentGpuResidency?.physical || [])],
        reduced: [...(g.currentGpuResidency?.reduced || [])],
        owners: [...(g.currentGpuResidency?.owners || [])],
        exactPasses: [...(g.currentGpuResidency?.exactPasses || [])],
        exactPreloadPasses: [...(g.currentGpuResidency?.exactPreloadPasses || [])],
        reducedPasses: [...(g.currentGpuResidency?.reducedPasses || [])],
        ownerPasses: [...(g.currentGpuResidency?.ownerPasses || [])],
        ownerUniverses: [...(g.currentGpuResidency?.ownerUniverses || [])],
        universeFinalizePasses: [...(g.currentGpuResidency?.universeFinalizePasses || [])],
        finalizerFrames,
        skullWorldPasses: [...(g.currentGpuResidency?.skullWorldPasses || [])],
        maxExactMs: g.currentGpuResidency?.maxExactMs || 0,
        maxExactPreloadMs: g.currentGpuResidency?.maxExactPreloadMs || 0,
        maxReducedPrimeMs: g.currentGpuResidency?.maxReducedPrimeMs || 0,
        maxOwnerMs: g.currentGpuResidency?.maxOwnerMs || 0,
        ownerFullFrames: g.currentGpuResidency?.ownerFullFrames || 0,
        deferredFullFrames: g.currentGpuResidency?.deferredFullFrames || 0,
        progress: (() => {
          const progress = g.currentGpuResidency?.progressive;
          return progress ? {
            key: progress.key,
            ownerQueue: progress.ownerQueue.length,
            ownerExactQueue: progress.ownerExactQueue.length,
            deferredQueue: progress.deferredQueue.length,
            deferredExactQueue: progress.deferredExactQueue.length,
            ownerRecorded: !!progress.ownerRecorded,
            ownerExactRecorded: !!progress.ownerExactRecorded,
            deferredRecorded: !!progress.deferredRecorded,
            deferredExactRecorded: !!progress.deferredExactRecorded,
            ownerFinalizeBlocked: !!progress.ownerFinalizeBlocked,
            deferredFinalizeBlocked: !!progress.deferredFinalizeBlocked,
          } : null;
        })(),
        errors: [...(g.currentGpuResidency?.errors || [])],
      },
    };
  });

  const settled = [];
  await page.evaluate(() => {
    const g = window.__game;
    g._selfStep = false;
    g.teleport('house');
    if (g.act !== 'house') throw new Error(`settled setup landed in ${g.act}, not house`);
  });
  for (const [name, act] of SEAMS) {
    const seam = await page.evaluate(async ({ name, act }) => {
      const g = window.__game, F = window.__FETCH;
      const intervals = [], renders = [], steps = [];
      const orderingErrors = [];
      let frameSerial = 0;
      const renderCadence = (rows) => ({
        renderCount: rows.length,
        maxRenderStartIntervalMs: Math.max(0, ...rows.slice(1)
          .map((row, index) => row.startedAt - rows[index].startedAt)),
        maxInterRenderIdleMs: Math.max(0, ...rows.slice(1)
          .map((row, index) => row.startedAt - rows[index].completedAt)),
        maxRenderCompletionIntervalMs: Math.max(0, ...rows.slice(1)
          .map((row, index) => row.completedAt - rows[index].completedAt)),
      });
      const realRender = g.render, realStep = g.step;
      const before = {
        act: g.act,
        programs: g.renderer.info.programs?.length ?? 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      };
      g.render = function measuredRender(...args) {
        const residencyBefore = g.currentGpuResidency;
        const passCountsBefore = {
          reduced: residencyBefore?.reducedPasses?.length || 0,
          exact: residencyBefore?.exactPasses?.length || 0,
          exactPreload: residencyBefore?.exactPreloadPasses?.length || 0,
          owner: residencyBefore?.ownerPasses?.length || 0,
          finalizer: residencyBefore?.universeFinalizePasses?.length || 0,
        };
        const startedAt = performance.now();
        try { return realRender.apply(this, args); }
        finally {
          const completedAt = performance.now();
          const residencyAfter = g.currentGpuResidency;
          const row = {
            frameId: ++frameSerial,
            generation: g._webglGeneration,
            startedAt,
            completedAt,
            atMs: completedAt,
            ms: completedAt - startedAt,
            drawCalls: g.lastRender?.drawCalls || 0,
            worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
            shielded: !!g._shaderTransitionShield,
            reducedDetail: !!g.lastRender?.reducedDetail,
            residencyKey: g.lastRender?.residencyKey || null,
            snapshotProgress: !!g.lastRender?.snapshotProgress,
            reducedBatchSubmitted: !!g.lastRender?.reducedBatchSubmitted,
            reducedBatchRevealed: !!g.lastRender?.reducedBatchRevealed,
            ownerProgress: !!g.lastRender?.ownerProgress,
            deferredProgress: !!g.lastRender?.deferredProgress,
            ownerExactProgress: !!g.lastRender?.ownerExactProgress,
            deferredExactProgress: !!g.lastRender?.deferredExactProgress,
            reducedPassesAdded: Math.max(0,
              (residencyAfter?.reducedPasses?.length || 0) - passCountsBefore.reduced),
            exactPassesAdded: Math.max(0,
              (residencyAfter?.exactPasses?.length || 0) - passCountsBefore.exact),
            exactPreloadPassesAdded: Math.max(0,
              (residencyAfter?.exactPreloadPasses?.length || 0) - passCountsBefore.exactPreload),
            ownerPassesAdded: Math.max(0,
              (residencyAfter?.ownerPasses?.length || 0) - passCountsBefore.owner),
            finalizerPassesAdded: Math.max(0,
              (residencyAfter?.universeFinalizePasses?.length || 0)
                - passCountsBefore.finalizer),
            visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
            visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
            visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
          };
          const namedHiddenPhase = row.worldDrawCalls === 0 && row.drawCalls === 0
            && (row.snapshotProgress || row.reducedBatchSubmitted
              || row.reducedBatchRevealed || row.ownerProgress || row.deferredProgress
              || row.ownerExactProgress || row.deferredExactProgress
              || row.reducedPassesAdded > 0 || row.exactPassesAdded > 0
              || row.exactPreloadPassesAdded > 0 || row.ownerPassesAdded > 0
              || row.finalizerPassesAdded > 0);
          row.lookPhase = row.worldDrawCalls > 0
            ? (row.reducedDetail ? 'reduced-reveal' : 'exact-visible')
            : namedHiddenPhase ? 'hidden-residency' : 'unowned-zero-draw';
          renders.push(row);
        }
      };
      g.step = function measuredStep(...args) {
        const at = performance.now();
        try { return realStep.apply(this, args); }
        finally { steps.push(performance.now() - at); }
      };
      // Synthetic post-story renderer fixture; legal path proof lives in the
      // focused Stage-C dynamics gate.
      if (act === 'cave' && !g.flags.has('waterfallTaken')) {
        g.director.waterfallTaken();
        g.skull.vanish();
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const transitionAt = performance.now();
      if (act === 'ossuary') {
        const ossuary = g.ossuary;
        ossuary.unlock('transition-warmup-settled');
        g.enemies.clear();
        if (g.skull.mode !== 'gone') g.skull.holdNow();
        const connector = ossuary.entranceConnector;
        g.player.pos.set(
          g.ritualMausoleum.x,
          ossuary.origin.floor + 0.34,
          connector.portalZ + 0.08,
        );
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        F.stepWith(1 / 120, {}, false);
        if (!ossuary.inOssuary) throw new Error('physical ossuary entry did not cross');
      } else {
        F.teleport(act);
        F.stepWith(0.05, {}, false);
      }
      if (act === 'ossuary') {
        if (g.act !== 'graveyard' || !g.ossuary.inOssuary) {
          throw new Error(`settled ossuary seam landed in ${g.act} without ossuary ownership`);
        }
      } else if (g.act !== act) {
        throw new Error(`${name} settled seam landed in ${g.act}, not ${act}`);
      }
      const transitionMs = performance.now() - transitionAt;
      const expectedKey = g._currentGpuResidencyKey();
      const expectedGeneration = g._webglGeneration;
      let previous = null;
      const observeCompletedFrame = (observedAt, scope) => {
        const completed = renders.at(-1) || null;
        const ordered = completed
          && completed.completedAt <= observedAt
          && completed.generation === expectedGeneration
          && completed.residencyKey === expectedKey
          && (!previous || completed.frameId > previous.frameId
            && previous.completedAt <= previous.observedAt);
        if (!ordered) {
          orderingErrors.push({ scope, previous, current: completed, observedAt,
            expectedGeneration, expectedKey });
          return;
        }
        if (previous) intervals.push(observedAt - previous.observedAt);
        previous = { ...completed, observedAt };
      };
      const settledDeadline = performance.now() + 120000;
      const exactPhysicalReady = () => {
        const residency = g.currentGpuResidency;
        const progress = residency?.progressive;
        return residency?.generation === g._webglGeneration
          && residency.activeKey === expectedKey && progress?.key === expectedKey
          && residency.physical.has(expectedKey)
          && !g.lastRender?.reducedDetail && (g.lastRender?.worldDrawCalls || 0) > 0;
      };
      while ((intervals.length < 8 || !exactPhysicalReady())
          && performance.now() < settledDeadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const observedAt = performance.now();
        observeCompletedFrame(observedAt, 'settle');
      }
      if (!exactPhysicalReady()) {
        throw new Error(`${name} did not reach an exact physical world before timeout`);
      }
      const originalView = { yaw: g.player.yaw, pitch: g.player.pitch };
      const sweepFrames = [];
      const sweepIntervals = [];
      let previousSweep = previous;
      for (let turn = 0; turn < 4; turn++) {
        const priorFrameId = renders.at(-1)?.frameId || 0;
        const lookAppliedAt = performance.now();
        g.player.yaw = originalView.yaw + turn * Math.PI / 2;
        g.player.pitch = originalView.pitch;
        g.player._sync(0);
        let completed = null;
        let observedAt = null;
        const freshDeadline = performance.now() + 2000;
        while (!completed && performance.now() < freshDeadline) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          observedAt = performance.now();
          const candidate = renders.at(-1) || null;
          if (candidate?.frameId > priorFrameId && candidate.startedAt >= lookAppliedAt
              && candidate.completedAt <= observedAt
              && candidate.generation === expectedGeneration
              && candidate.residencyKey === expectedKey) completed = candidate;
        }
        const ordered = completed && completed.frameId > (previousSweep?.frameId || 0)
          && completed.completedAt <= observedAt;
        if (!ordered) orderingErrors.push({ scope: 'sweep', previous: previousSweep,
          current: completed, observedAt, expectedGeneration, expectedKey });
        else {
          if (previousSweep) sweepIntervals.push(observedAt - previousSweep.observedAt);
          previousSweep = { ...completed, observedAt };
        }
        sweepFrames.push(completed ? { ...completed, lookTurn: turn, lookAppliedAt } : null);
      }
      g.player.yaw = originalView.yaw;
      g.player.pitch = originalView.pitch;
      g.player._sync(0);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      g.render = realRender;
      g.step = realStep;
      g._syncShaderBallast();
      const visibleWorldLights = [];
      g.scene.traverseVisible((object) => {
        if (object.isLight && (object.layers.mask & 3) !== 0) visibleWorldLights.push(object);
      });
      const lightTypes = visibleWorldLights.reduce((out, light) => {
        out[light.type] = (out[light.type] || 0) + 1;
        if (light.castShadow) {
          out.totalShadows = (out.totalShadows || 0) + 1;
          if (light.isDirectionalLight) out.directionalShadows =
            (out.directionalShadows || 0) + 1;
        }
        return out;
      }, { totalShadows: 0, directionalShadows: 0 });
      const after = {
        act: g.act,
        programs: g.renderer.info.programs?.length ?? 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
        worldLights: visibleWorldLights.length,
        lightTypes,
        ballastViolations: visibleWorldLights.filter((light) =>
          light.userData?.fetchShaderBallast && (
            light.intensity !== 0
            || ((light.isPointLight || light.isSpotLight) && light.castShadow)
            || (light.isDirectionalLight && !light.castShadow)
          )).map((light) => ({ name: light.name, intensity: light.intensity,
            type: light.type, castShadow: light.castShadow })),
      };
      let cleanupMs = 0;
      if (act === 'ossuary') {
        const cleanupStartedAt = performance.now();
        for (let index = 0; index < 15 && g.ossuary.portalCooldown > 0; index++) {
          F.stepWith(0.04, {}, false);
        }
        g.player.pos.set(g.ossuary.origin.x, g.ossuary.origin.floor,
          g.ossuary.origin.z + 0.2);
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        F.stepWith(1 / 120, {}, false);
        if (g.ossuary.inOssuary || g.ossuary.root.visible) {
          throw new Error('settled ossuary backtrack did not restore the graveyard');
        }
        cleanupMs = performance.now() - cleanupStartedAt;
      }
      return {
        name,
        expectedGeneration,
        expectedKey,
        before,
        after,
        transitionMs,
        cleanupMs,
        orderingErrors,
        maxRafMs: Math.max(...intervals),
        intervals,
        maxRenderMs: Math.max(...renders.map((entry) => entry.ms)),
        ...renderCadence(renders.filter((entry) => entry.atMs >= transitionAt)),
        firstWorldMs: (() => {
          const first = renders.find((entry) => entry.atMs >= transitionAt
            && entry.worldDrawCalls > 0);
          return first ? first.atMs - transitionAt : null;
        })(),
        worldSubmitted: renders.some((entry) => entry.atMs >= transitionAt
          && entry.worldDrawCalls > 0),
        shieldFrames: renders.filter((entry) => entry.atMs >= transitionAt && entry.shielded).length,
        reducedFrames: renders.filter((entry) => entry.atMs >= transitionAt && entry.reducedDetail).length,
        maxVisibleProgramDelta: Math.max(0, ...renders
          .filter((entry) => entry.atMs >= transitionAt)
          .map((entry) => entry.visibleProgramDelta)),
        maxVisibleTextureDelta: Math.max(0, ...renders
          .filter((entry) => entry.atMs >= transitionAt)
          .map((entry) => entry.visibleTextureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...renders
          .filter((entry) => entry.atMs >= transitionAt)
          .map((entry) => entry.visibleGeometryDelta)),
        maxStepMs: Math.max(...steps),
        sweepFrames,
        sweepMaxRafMs: Math.max(0, ...sweepIntervals),
      };
    }, { name, act });
    seam.p95RafMs = percentile(seam.intervals, 0.95);
    delete seam.intervals;
    settled.push(seam);
  }
  const caveTail = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    g._selfStep = false;
    // Enter the authored post-sacrifice state directly because this lane owns
    // only the 2,400-step cave update tail, not progression legality.
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('cave');
    if (g.act !== 'cave') throw new Error(`cave-tail fixture landed in ${g.act}, not cave`);
    F.stepWith(0.05, {}, false);
    // Isolate the district's steady 120 Hz path. Threat construction has its
    // own focused suite; this loop is specifically the culler/wayfinding/room
    // update that used to allocate a Set + enemy array and rewrite the entire
    // scene twice per fixed step.
    g.director._caveEcology = null;
    g.enemies.endDrownedChoir?.('performance-tail');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const visibility = g.underfalls.visibility;
    const metricsBefore = { ...visibility.metrics };
    const ballastMetricsBefore = {
      registryRefreshes: g._shaderBallast?.registryRefreshes || 0,
      syncs: g._shaderBallast?.syncs || 0,
      registrySize: g._shaderBallast?.authoredLights?.length || 0,
    };
    const effectiveWorldLights = [];
    g.scene.traverseVisible((object) => {
      if (object.isLight && (object.layers.mask & 1) !== 0) effectiveWorldLights.push(object);
    });
    const allowed = new Set([...visibility.allowedCaveLights, g.fillLight]);
    const unexpectedLights = effectiveWorldLights
      .filter((light) => !allowed.has(light))
      .map((light) => ({ uuid: light.uuid, name: light.name, type: light.type }));
    const missingLights = [...allowed]
      .filter((light) => !effectiveWorldLights.includes(light))
      .map((light) => ({ uuid: light.uuid, name: light.name, type: light.type }));
    const lightTypes = effectiveWorldLights.reduce((out, light) => {
      out[light.type] = (out[light.type] || 0) + 1;
      if (light.castShadow) {
        out.totalShadows = (out.totalShadows || 0) + 1;
        if (light.isDirectionalLight) out.directionalShadows =
          (out.directionalShadows || 0) + 1;
      }
      return out;
    }, { totalShadows: 0, directionalShadows: 0 });
    const caveShellRoots = [g.underfalls.shellRoot].filter((root) =>
      root?.isMesh && root.material === g.underfalls.shellMaterial
      && g.underfalls.renderRoots.includes(root));
    const exteriorRockRoots = g.scene.children.filter((root) =>
      root?.isMesh && root.material === g.mats.rock
      && !g.underfalls.renderRoots.includes(root));
    const programsBefore = g.renderer.info.programs?.length || 0;
    const texturesBefore = g.renderer.info.memory.textures;
    const heapBefore = performance.memory?.usedJSHeapSize ?? null;
    let heapPeak = heapBefore;
    const steps = [];
    const neutral = {
      moveX: 0, moveZ: 0, run: false, lookX: 0, lookY: 0,
      throwHeld: false, callHeld: false,
      throwPressed: false, throwReleased: false, callTap: false,
      interactPressed: false, jumpPressed: false,
    };
    for (let chunk = 0; chunk < 20; chunk++) {
      if (chunk === 7 || chunk === 14) {
        const node = chunk === 7 ? g.underfalls.layout.chapel : g.underfalls.layout.upperSluice;
        g.player.pos.set(
          node.x,
          g.underfalls.groundAt(node.x, node.z),
          node.z,
        );
        g.player.vel.set(0, 0, 0);
        g.player._sync(0);
      }
      for (let i = 0; i < 120; i++) {
        const at = performance.now();
        g.step(1 / 120, neutral);
        steps.push(performance.now() - at);
      }
      if (performance.memory && heapPeak != null) {
        heapPeak = Math.max(heapPeak, performance.memory.usedJSHeapSize);
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const heapAfter = performance.memory?.usedJSHeapSize ?? null;
    const metricsAfter = { ...visibility.metrics };
    const ballastMetricsAfter = {
      registryRefreshes: g._shaderBallast?.registryRefreshes || 0,
      syncs: g._shaderBallast?.syncs || 0,
      registrySize: g._shaderBallast?.authoredLights?.length || 0,
    };
    steps.sort((a, b) => a - b);
    const quantile = (p) => steps[Math.min(steps.length - 1,
      Math.max(0, Math.ceil(steps.length * p) - 1))] || 0;
    return {
      samples: steps.length,
      maxStepMs: Math.max(0, ...steps),
      p95StepMs: quantile(0.95),
      p99StepMs: quantile(0.99),
      programsBefore,
      programsAfter: g.renderer.info.programs?.length || 0,
      texturesBefore,
      texturesAfter: g.renderer.info.memory.textures,
      metricsBefore,
      metricsAfter,
      ballastMetricsBefore,
      ballastMetricsAfter,
      visibleWorldLightCount: effectiveWorldLights.length,
      allowedWorldLightCount: allowed.size,
      unexpectedLights,
      missingLights,
      lightTypes,
      caveShellRoots: caveShellRoots.map((root) => ({
        uuid: root.uuid, name: root.name, visible: root.visible,
        vertices: root.geometry?.attributes?.position?.count || 0,
      })),
      exteriorRockRoots: exteriorRockRoots.map((root) => ({
        uuid: root.uuid, name: root.name, visible: root.visible,
        vertices: root.geometry?.attributes?.position?.count || 0,
      })),
      heapBefore,
      heapAfter,
      heapPeak,
      heapPeakGrowth: heapBefore == null || heapPeak == null ? null : heapPeak - heapBefore,
      heapEndGrowth: heapBefore == null || heapAfter == null ? null : heapAfter - heapBefore,
    };
  });
  const gl = await page.evaluate(() => {
    const context = window.__game.renderer.getContext();
    const info = context.getExtension('WEBGL_debug_renderer_info');
    return info
      ? context.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER);
  });
  report.browserErrors.push(...opened.errors.map((error) => `settled: ${error}`));
  await page.close();
  return { purity, settled, caveTail, renderer: gl };
}

async function runContextRecovery(browser) {
  const opened = await openPage(browser, report.url);
  const { page } = opened;
  await ready(page);
  const value = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    const gl = g.renderer.getContext();
    const lose = gl.getExtension('WEBGL_lose_context');
    if (!lose) return { supported: false };
    const canvas = g.renderer.domElement;
    const waitFor = async (predicate, label, timeout = 90000, onTimeout = null) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      if (!predicate()) {
        let detail = null;
        try { detail = onTimeout?.() ?? null; }
        catch (error) { detail = { snapshotError: error?.message || `${error}` }; }
        const suffix = detail == null ? '' : `\n${JSON.stringify(detail)}`;
        throw new Error(`context recovery timed out: ${label}${suffix}`);
      }
    };
    const contextEvent = (name, action) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`missing ${name}`)), 20000);
      canvas.addEventListener(name, () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      action();
    });
    // Chrome/D3D11 may ignore restoreContext while the lost-event dispatch is
    // still unwinding. A paint-sized task boundary makes the adversarial cycle
    // deterministic without giving shader/target work time to counterfeit a
    // successful generation.
    const restoreContext = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return contextEvent('webglcontextrestored', () => lose.restoreContext());
    };
    const lightCensus = (camera) => {
      const out = {
        AmbientLight: 0, HemisphereLight: 0, DirectionalLight: 0,
        SpotLight: 0, PointLight: 0, total: 0,
        directionalShadows: 0, spotShadows: 0, pointShadows: 0, totalShadows: 0,
      };
      g.scene.traverseVisible((object) => {
        if (!object.isLight || !object.layers.test(camera.layers)
            || !(object.type in out)) return;
        out[object.type]++;
        out.total++;
        if (!object.castShadow) return;
        out.totalShadows++;
        if (object.isDirectionalLight) out.directionalShadows++;
        else if (object.isSpotLight) out.spotShadows++;
        else if (object.isPointLight) out.pointShadows++;
      });
      return out;
    };
    // This evaluator owns a separate browser closure from the settled/purity
    // probe above. Keep the outbound-skull snapshot local so context recovery
    // cannot accidentally depend on a helper declared in another page.evaluate.
    const skullFlightState = () => ({
      mode: g.skull.mode,
      parent: g.skull.root.parent?.uuid || null,
      position: g.skull.pos.toArray(),
      previous: g.skull.prevPos.toArray(),
      velocity: g.skull.vel.toArray(),
      flightTime: g.skull.flightTime,
      freeFlightTime: g.skull.freeFlightTime,
      outboundDuration: g.skull.outboundDuration,
      hardAway: g.skull.hardAway,
      maxRange: g.skull.maxRange,
      returnTime: g.skull.returnTime,
      returnStuck: g.skull.returnStuck,
      returnSide: g.skull.returnSide,
      stage: g.skull.stage,
      pendingStage: g.skull.pendingStage,
      carry: g.skull.carry?.id || null,
      nodes: (() => {
        const nodes = [];
        g.skull.root.traverse((object) => {
          if (!object.isLight) nodes.push({
            uuid: object.uuid,
            visible: object.visible,
            frustumCulled: object.frustumCulled,
            layerMask: object.layers.mask,
          });
        });
        return nodes;
      })(),
      tether: {
        visible: g.skull.tether.visible,
        opacity: g.skull.tether.material.opacity,
        frustumCulled: g.skull.tether.frustumCulled,
        layerMask: g.skull.tether.layers.mask,
      },
    });
    const state = () => ({
      act: g.act,
      player: [g.player.pos.x, g.player.pos.y, g.player.pos.z, g.player.yaw, g.player.pitch],
      flags: [...g.flags].sort(),
      enemies: g.enemies.list.map((enemy) => ({
        uuid: enemy.mesh.uuid, kind: enemy.kind, state: enemy.state,
        parent: enemy.mesh.parent?.uuid || null,
      })),
      choir: g.enemies.choir?.mesh?.uuid || null,
      spawnSerial: g.enemies._spawnSerial,
      spawnLog: JSON.stringify(g.spawnLog || []),
      audioReady: g.audio.ready,
      audioLoops: g.audio._loops?.size || 0,
      skullStage: g.skull.stage,
      skullMode: g.skull.mode,
      skullParent: g.skull.root.parent?.uuid || null,
      exactHead: g.finale.figure.userData.exactHead?.uuid || null,
      headChildren: g.finale.figure.userData.headMount.children.map((child) => child.uuid),
      figureVisible: g.finale.figure.visible,
      finaleActive: g.finale.active,
      finalePhase: g.finale.phase,
      contextRewarming: g.finale._contextRewarming,
      rendererTarget: g.renderer.getRenderTarget()?.uuid || null,
      sceneParents: g.scene.children.map((child) => `${child.uuid}:${child.parent?.uuid || ''}`).sort(),
    });
    const mark = (label) => ({
      label,
      generation: g._webglGeneration,
      shader: {
        status: g.shaderWarmup?.status,
        generation: g.shaderWarmup?.generation,
        reason: g.shaderWarmup?.reason || null,
        choirLights: g.shaderWarmup?.choirLights ?? null,
        reflectionLights: g.shaderWarmup?.reflectionLights ?? null,
        reflectionUsesMountedHeadLight: g.shaderWarmup?.reflectionUsesMountedHeadLight ?? null,
      },
      targets: g.finale._targetWarmState ? {
        status: g.finale._targetWarmState.status,
        generation: g.finale._targetWarmState.generation,
        warmed: g.finale._targetWarmState.warmed,
        attempts: [...(g.finale._targetWarmState.attempts || [])],
        failedTargets: [...(g.finale._targetWarmState.failedTargets || [])],
      } : null,
      finale: {
        active: g.finale.active,
        rewarming: g.finale._contextRewarming,
        rewarmGeneration: g.finale._contextRewarmGeneration,
      },
    });
    const stages = [mark('initial-scheduled')];
    const restoreProbes = [];
    const finalizerFrames = [];
    const seenFinalizers = new WeakSet();
    let frameSerial = 0;
    let lastCompletedRender = null;
    let activeRestoreProbe = null;
    const originalGameRender = g.render;
    g.render = function measuredRestoreWorld(...args) {
      const at = performance.now();
      const beforePrograms = g.renderer.info.programs?.length || 0;
      const beforeTextures = g.renderer.info.memory.textures;
      const beforeGeometries = g.renderer.info.memory.geometries;
      const ownerPassCountBefore = g.currentGpuResidency?.ownerPasses?.length || 0;
      let rendered;
      try { rendered = originalGameRender.apply(this, args); }
      finally {
        const completedAt = performance.now();
        const row = {
          frameId: ++frameSerial,
          at,
          completedAt,
          ms: completedAt - at,
          act: g.act,
          generation: g._webglGeneration,
          key: g.currentGpuResidency?.progressive?.key || null,
          drawCalls: g.lastRender?.drawCalls || 0,
          worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
          shielded: !!g._shaderTransitionShield,
          reducedDetail: !!g.lastRender?.reducedDetail,
          residencyKey: g.lastRender?.residencyKey || null,
          impactPrime: !!g._impactRing?.userData?.bootPrime,
          impactVisible: !!g._impactRing?.visible,
          flamePrime: !!g.flameCircuit?.prewarmPending,
          flameEmberVisible: !!g.flameCircuit?.embers?.[0]?.group?.visible,
          flameSparkVisible: !!g.flameCircuit?.transferSparks?.[0]?.visible,
          rendererFrame: g.renderer.info.render.frame,
          programDelta: g.lastRender?.visibleProgramDelta || 0,
          textureDelta: g.lastRender?.visibleTextureDelta || 0,
          geometryDelta: g.lastRender?.visibleGeometryDelta || 0,
          rawProgramDelta: (g.renderer.info.programs?.length || 0) - beforePrograms,
          rawTextureDelta: g.renderer.info.memory.textures - beforeTextures,
          rawGeometryDelta: g.renderer.info.memory.geometries - beforeGeometries,
          ownerPassesAdded: [...(g.currentGpuResidency?.ownerPasses || [])]
            .slice(ownerPassCountBefore),
          houseMirrorActive: !!g.houseMirror?.active,
          housePaneActive: !!g.houseMirror?.pane?.active,
          finalePanesActive: g.finale?.panes?.filter((pane) => pane.active).length || 0,
        };
        lastCompletedRender = row;
        if (activeRestoreProbe?.restoredAt != null) activeRestoreProbe.frames.push(row);
        for (const entry of g.currentGpuResidency?.universeFinalizePasses || []) {
          if (seenFinalizers.has(entry)) continue;
          seenFinalizers.add(entry);
          finalizerFrames.push({
            ...entry,
            frameId: row.frameId,
            renderGeneration: row.generation,
            renderKey: row.key,
            renderMs: row.ms,
            worldDrawCalls: row.worldDrawCalls,
            drawCalls: row.drawCalls,
            reducedDetail: row.reducedDetail,
          });
        }
      }
      return rendered;
    };
    const sampleOwnedFrames = async ({ count, label, generation, key = null }) => {
      const frames = [];
      const orderingErrors = [];
      const observedIntervals = [];
      let previous = null;
      for (let index = 0; index < count; index++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const observedAt = performance.now();
        const completed = lastCompletedRender;
        const ordered = completed
          && completed.completedAt <= observedAt
          && completed.generation === generation
          && (key == null || completed.key === key)
          && (!previous || completed.frameId > previous.frameId
            && previous.completedAt <= previous.observedAt);
        if (!ordered) orderingErrors.push({ label, index, generation, key,
          previous, current: completed, observedAt });
        else {
          if (previous) observedIntervals.push(observedAt - previous.observedAt);
          previous = { ...completed, observedAt };
          frames.push(previous);
        }
      }
      return {
        label,
        generation,
        key,
        frames,
        orderingErrors,
        observedIntervals: observedIntervals.length,
        maxObservedIntervalMs: Math.max(0, ...observedIntervals),
        maxRenderMs: Math.max(0, ...frames.map((frame) => frame.ms)),
        maxRenderStartIntervalMs: Math.max(0, ...frames.slice(1)
          .map((frame, index) => frame.at - frames[index].at)),
        maxInterRenderIdleMs: Math.max(0, ...frames.slice(1)
          .map((frame, index) => frame.at - frames[index].completedAt)),
        maxRenderCompletionIntervalMs: Math.max(0, ...frames.slice(1)
          .map((frame, index) => frame.completedAt - frames[index].completedAt)),
      };
    };
    const beginRestoreProbe = (label) => {
      const probe = { label, restoredAt: null, generation: null, key: null, frames: [] };
      restoreProbes.push(probe);
      activeRestoreProbe = probe;
      return probe;
    };
    const markRestored = (probe) => {
      probe.restoredAt = performance.now();
      probe.generation = g._webglGeneration;
      probe.key = g._currentGpuResidencyKey();
    };
    const waitForRestoreReveal = async (probe) => {
      await waitFor(() => probe.frames.some((frame) =>
        frame.at >= probe.restoredAt && frame.worldDrawCalls > 0 && !frame.shielded),
      `${probe.label} first restored world`, 20000);
      probe.playableAt = performance.now();
    };
    const waitForRestoreExact = async (probe, { keepActive = false } = {}) => {
      await waitFor(() => probe.frames.some((frame) =>
        frame.at >= probe.restoredAt && frame.worldDrawCalls > 0
          && !frame.shielded && !frame.reducedDetail),
      `${probe.label} first exact restored world`, 90000);
      probe.completedAt = performance.now();
      probe.exactPass = [...(g.currentGpuResidency?.exactPasses || [])].at(-1) || null;
      probe.afterFullSubmission = {
        pending: !!g.flameCircuit?.prewarmPending,
        emberVisible: !!g.flameCircuit?.embers?.[0]?.group?.visible,
        sparkVisible: !!g.flameCircuit?.transferSparks?.[0]?.visible,
      };
      if (!keepActive && activeRestoreProbe === probe) activeRestoreProbe = null;
    };
    const compactWarmEntries = (entries) => (entries || []).slice(-8).map((entry) => ({
      label: entry.label || null,
      kind: entry.kind || null,
      phase: entry.phase || null,
      status: entry.status || null,
      generation: entry.generation ?? null,
      key: entry.key || null,
      atMs: entry.atMs ?? null,
      settledMs: entry.settledMs ?? null,
      durationMs: entry.durationMs ?? entry.ms ?? null,
      submitDurationMs: entry.submitDurationMs ?? null,
      renderDurationMs: entry.renderDurationMs ?? null,
      maxSynchronousSliceMs: entry.maxSynchronousSliceMs ?? null,
      invalidated: entry.invalidated ?? null,
      drainedAfterInvalidation: entry.drainedAfterInvalidation ?? null,
      complete: entry.complete ?? null,
      recorded: entry.recorded ?? null,
      error: entry.error || null,
    }));
    const targetSnapshot = (target) => target ? {
      status: target.status || null,
      generation: target.generation ?? null,
      warmed: target.warmed ?? null,
      budget: target.budget ?? null,
      attempts: Array.isArray(target.attempts) ? target.attempts.slice(-8) : target.attempts ?? null,
      failed: target.failed ?? null,
      failedTargets: [...(target.failedTargets || [])],
      errors: [...(target.errors || [])],
      maxSliceMs: target.maxSliceMs ?? null,
    } : null;
    const contextTimeoutSnapshot = (probe) => {
      const shader = g.shaderWarmup || null;
      const residency = g.currentGpuResidency || null;
      const progress = residency?.progressive || null;
      const expectedKey = g._currentGpuResidencyKey?.() || null;
      const compileActivity = g._shaderCompileActivity || null;
      return {
        now: performance.now(),
        contextLost: !!gl.isContextLost?.(),
        generation: g._webglGeneration,
        frameSerial,
        shader: shader ? {
          status: shader.status || null,
          generation: shader.generation ?? null,
          reason: shader.reason || null,
          startedAt: shader.startedAt ?? null,
          completedAt: shader.completedAt ?? null,
          errors: [...(shader.errors || [])],
          recoveryRound: shader.recoveryRound ?? null,
          recoveryScheduled: !!shader.recoveryScheduled,
          bootstrapResumeScheduled: !!shader.bootstrapResumeScheduled,
          readyVariants: [...(shader.readyVariants || [])],
          carriedReadyVariants: [...(shader.carriedReadyVariants || [])],
          currentExactKey: shader.currentExactKey || null,
          currentExactRevision: shader.currentExactRevision ?? null,
          currentExactUniverse: shader.currentExactUniverse ?? null,
          currentExactStatus: shader.currentExactStatus || null,
          compileInFlightLabel: shader.compileInFlightLabel || null,
          compileJobsInFlight: shader.compileJobsInFlight ?? null,
          generationCompileJobsInFlight: compileActivity?.active
            ?? shader.generationCompileJobsInFlight ?? null,
          generationMaxCompileJobsInFlight: compileActivity?.peak
            ?? shader.generationMaxCompileJobsInFlight ?? null,
          pendingTextures: shader.pendingTextures ?? null,
          setupSliceCount: shader.setupSlices?.length ?? null,
          compileSliceCount: shader.compileSlices?.length ?? null,
          textureSliceCount: shader.textureSlices?.length ?? null,
          compileJobCount: shader.compileJobs?.length ?? null,
          setupSlices: compactWarmEntries(shader.setupSlices),
          compileSlices: compactWarmEntries(shader.compileSlices),
          textureSlices: compactWarmEntries(shader.textureSlices),
          compileJobs: compactWarmEntries(shader.compileJobs),
        } : null,
        residency: residency ? {
          generation: residency.generation ?? null,
          reason: residency.reason || null,
          activeKey: residency.activeKey || null,
          expectedKey,
          progressiveKey: progress?.key || null,
          bootstrapStatus: residency.bootstrapStatus || null,
          surfaceStatus: residency.surfaceStatus || null,
          bootstrapNext: residency.bootstrapNext ?? null,
          errors: [...(residency.errors || [])],
          queues: progress ? {
            reduced: progress.queue?.length ?? null,
            exact: progress.exactQueue?.length ?? null,
            owner: progress.ownerQueue?.length ?? null,
            ownerExact: progress.ownerExactQueue?.length ?? null,
            deferred: progress.deferredQueue?.length ?? null,
            deferredExact: progress.deferredExactQueue?.length ?? null,
          } : null,
          coverage: progress ? {
            owner: progress.ownerCovered?.size ?? null,
            ownerUniverse: progress.ownerUniverse?.size ?? null,
            ownerExact: progress.ownerExactCovered?.size ?? null,
            ownerExactUniverse: progress.ownerExactUniverse?.size ?? null,
            deferred: progress.deferredCovered?.size ?? null,
            deferredUniverse: progress.deferredUniverse?.size ?? null,
            deferredExact: progress.deferredExactCovered?.size ?? null,
            deferredExactUniverse: progress.deferredExactUniverse?.size ?? null,
          } : null,
          recorded: progress ? {
            owner: !!progress.ownerRecorded,
            ownerExact: !!progress.ownerExactRecorded,
            deferred: !!progress.deferredRecorded,
            deferredExact: !!progress.deferredExactRecorded,
            ownerFinalizeBlocked: !!progress.ownerFinalizeBlocked,
            deferredFinalizeBlocked: !!progress.deferredFinalizeBlocked,
            snapshotReady: !!progress.snapshotReady,
            complete: !!progress.complete,
            exactShaderRevision: progress.exactShaderRevision ?? null,
          } : null,
          membership: {
            reduced: expectedKey == null ? null : residency.reduced?.has(expectedKey) ?? null,
            physical: expectedKey == null ? null : residency.physical?.has(expectedKey) ?? null,
          },
          bootstrapPasses: compactWarmEntries(residency.bootstrapPasses),
          surfacePasses: compactWarmEntries(residency.surfacePasses),
          snapshotPasses: compactWarmEntries(residency.snapshotPasses),
        } : null,
        targets: {
          house: targetSnapshot(g._houseMirrorTargetWarmState),
          finale: targetSnapshot(g.finale?._targetWarmState),
        },
        lastCompletedRender: lastCompletedRender ? { ...lastCompletedRender } : null,
        restoreFrames: (probe?.frames || []).slice(-8).map((frame) => ({ ...frame })),
      };
    };
    const shaderProgressSignature = () => {
      const shader = g.shaderWarmup || null;
      const houseTarget = g._houseMirrorTargetWarmState || null;
      const finaleTarget = g.finale?._targetWarmState || null;
      const compileActivity = g._shaderCompileActivity || null;
      const lastJob = shader?.compileJobs?.at(-1) || null;
      return JSON.stringify([
        g._webglGeneration,
        shader?.generation, shader?.status, shader?.reason,
        shader?.recoveryRound, shader?.recoveryScheduled,
        shader?.setupSlices?.length, shader?.compileSlices?.length,
        shader?.textureSlices?.length, shader?.compileJobs?.length,
        shader?.pendingTextures, shader?.compileJobsInFlight,
        shader?.compileInFlightLabel,
        lastJob?.label, lastJob?.settledMs, lastJob?.error,
        compileActivity?.generation, compileActivity?.active,
        shader?.currentExactKey, shader?.currentExactRevision,
        shader?.currentExactStatus,
        (shader?.readyVariants || []).join('|'),
        houseTarget?.generation, houseTarget?.status, houseTarget?.warmed,
        houseTarget?.recoveryRound, houseTarget?.recoveryScheduled,
        houseTarget?.attempts, houseTarget?.failedTargets?.length,
        finaleTarget?.generation, finaleTarget?.status, finaleTarget?.warmed,
        finaleTarget?.recoveryRound, finaleTarget?.recoveryScheduled,
        finaleTarget?.attempts, finaleTarget?.failedTargets?.length,
      ]);
    };
    const waitForShaderReady = async ({
      label, probe, extra = () => true, terminal = () => null,
    }) => {
      // A generation-wide itinerary contains hundreds of serial D3D11 jobs. Its
      // wall time is not a frame budget: retain the strict per-render/slice gates,
      // but fail a genuinely stuck itinerary by progress rather than an obsolete
      // fixed 90-second total. The hard ceiling remains finite and diagnostic.
      const hardDeadline = performance.now() + 240000;
      let progressDeadline = performance.now() + 30000;
      let signature = shaderProgressSignature();
      while (performance.now() < hardDeadline) {
        const shader = g.shaderWarmup;
        if (!shader || g._webglGeneration !== probe?.generation
            || shader.generation !== probe?.generation
            || shader.status === 'invalidated') {
          throw new Error(`context recovery shader identity failed: ${label}\n${JSON.stringify(
            contextTimeoutSnapshot(probe),
          )}`);
        }
        if (shader?.status === 'skipped'
            || (shader?.status === 'degraded' && !shader.recoveryScheduled)) {
          throw new Error(`context recovery shader terminal state: ${label}\n${JSON.stringify(
            contextTimeoutSnapshot(probe),
          )}`);
        }
        const terminalReason = terminal();
        if (terminalReason) {
          throw new Error(`context recovery dependency terminal state: ${label}: ${terminalReason}\n${JSON.stringify(
            contextTimeoutSnapshot(probe),
          )}`);
        }
        if (shader.status === 'ready' && extra()) return;
        const nextSignature = shaderProgressSignature();
        if (nextSignature !== signature) {
          signature = nextSignature;
          progressDeadline = performance.now() + 30000;
        } else if (performance.now() >= progressDeadline) {
          throw new Error(`context recovery shader made no progress: ${label}\n${JSON.stringify(
            contextTimeoutSnapshot(probe),
          )}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`context recovery shader exceeded hard ceiling: ${label}\n${JSON.stringify(
        contextTimeoutSnapshot(probe),
      )}`);
    };
    const waitForCurrentHouseOwnerSettlement = async ({ label, generation, key }) => {
      const startedAt = performance.now();
      // A new physical key must earn a new current-view exact certificate before
      // owner work can resume. That certificate advances through the same serial
      // D3D11 itinerary as context recovery, so watch its semantic milestones
      // instead of declaring the unchanged owner counters dead after 30 seconds.
      const hardDeadline = startedAt + 240000;
      let progressDeadline = startedAt + 30000;
      let signature = null;
      const snapshot = () => {
        const residency = g.currentGpuResidency;
        const progress = residency?.progressive;
        const shader = g.shaderWarmup || null;
        const compileActivity = g._shaderCompileActivity || null;
        const lastJob = shader?.compileJobs?.at(-1) || null;
        const ownerKey = g._ownerGpuResidencyKey('house');
        const universe = (residency?.ownerUniverses || []).find((entry) => entry.key === key);
        const finalizers = (residency?.universeFinalizePasses || []).filter((entry) =>
          entry.generation === generation && entry.key === key
            && entry.scope === 'owner' && entry.kind === 'house-owner-exact-finalize');
        const target = g._houseMirrorTargetWarmState;
        const liveTarget = g.houseMirror?.pool?.pool?.[0] || null;
        return {
          generation: g._webglGeneration,
          residencyGeneration: residency?.generation ?? null,
          activeKey: residency?.activeKey || null,
          progressKey: progress?.key || null,
          physical: residency?.physical?.has(key) || false,
          queue: progress?.queue?.length ?? null,
          pendingReveal: progress?.pendingReducedReveal?.length ?? null,
          exactQueue: progress?.exactQueue?.length ?? null,
          exactCovered: progress?.exactCovered?.size ?? null,
          exactTotal: progress?.exactUniverse?.size ?? null,
          exactShaderRevision: progress?.exactShaderRevision ?? null,
          exactPreloadPasses: residency?.exactPreloadPasses?.length ?? null,
          ownerQueue: progress?.ownerQueue?.length ?? null,
          ownerExactQueue: progress?.ownerExactQueue?.length ?? null,
          ownerCovered: progress?.ownerCovered?.size ?? null,
          ownerTotal: progress?.ownerUniverse?.size ?? null,
          ownerExactCovered: progress?.ownerExactCovered?.size ?? null,
          ownerExactTotal: progress?.ownerExactUniverse?.size ?? null,
          ownerRecorded: !!progress?.ownerRecorded,
          ownerExactRecorded: !!progress?.ownerExactRecorded,
          ownerFinalizeBlocked: !!progress?.ownerFinalizeBlocked,
          failedOwners: progress?.failedOwners?.size ?? null,
          ownerCertified: residency?.owners?.has(ownerKey) || false,
          ownerPasses: residency?.ownerPasses?.length || 0,
          universe: universe ? {
            key: universe.key,
            total: universe.total,
            covered: universe.covered,
            exactTotal: universe.exactTotal,
            exactCovered: universe.exactCovered,
          } : null,
          finalizers: finalizers.map((entry) => ({
            recorded: entry.recorded, error: entry.error, durationMs: entry.durationMs,
          })),
          target: target ? {
            generation: target.generation,
            status: target.status,
            warmed: target.warmed,
            current: target.targetRef === liveTarget
              && target.targetUuid === liveTarget?.texture?.uuid,
          } : null,
          shader: shader ? {
            generation: shader.generation,
            status: shader.status,
            reason: shader.reason || null,
            recoveryRound: shader.recoveryRound ?? null,
            recoveryScheduled: !!shader.recoveryScheduled,
            setupSlices: shader.setupSlices?.length ?? null,
            compileSlices: shader.compileSlices?.length ?? null,
            textureSlices: shader.textureSlices?.length ?? null,
            compileJobs: shader.compileJobs?.length ?? null,
            compileJobsInFlight: shader.compileJobsInFlight ?? null,
            compileInFlightLabel: shader.compileInFlightLabel || null,
            lastJob: lastJob ? {
              label: lastJob.label || null,
              settledMs: lastJob.settledMs ?? null,
              error: lastJob.error || null,
            } : null,
            activityGeneration: compileActivity?.generation ?? null,
            activityActive: compileActivity?.active ?? null,
            currentExactKey: shader.currentExactKey || null,
            currentExactRevision: shader.currentExactRevision ?? null,
            currentExactStatus: shader.currentExactStatus || null,
            readyVariants: [...(shader.readyVariants || [])],
          } : null,
          mirrorActive: !!g.houseMirror?.active,
          paneActive: !!g.houseMirror?.pane?.active,
          errors: [...(residency?.errors || [])],
        };
      };
      while (performance.now() < hardDeadline) {
        const residency = g.currentGpuResidency;
        const progress = residency?.progressive;
        const current = snapshot();
        if (current.generation !== generation || current.residencyGeneration !== generation
            || current.activeKey !== key || current.progressKey !== key) {
          throw new Error(`context recovery owner identity drift: ${label}: ${JSON.stringify(current)}`);
        }
        if (!current.shader || current.shader.generation !== generation
            || current.shader.status === 'invalidated'
            || current.shader.status === 'skipped'
            || (current.shader.status === 'degraded'
              && !current.shader.recoveryScheduled)) {
          throw new Error(`context recovery owner shader terminal: ${label}: ${JSON.stringify(current)}`);
        }
        if (current.paneActive || current.mirrorActive) {
          throw new Error(`context recovery owner settlement exposed a pane: ${label}: ${JSON.stringify(current)}`);
        }
        if (current.ownerFinalizeBlocked || current.failedOwners > 0
            || current.errors.length > 0) {
          throw new Error(`context recovery owner settlement terminal: ${label}: ${JSON.stringify(current)}`);
        }
        const finalizer = (residency.universeFinalizePasses || []).find((entry) =>
          entry.generation === generation && entry.key === key
            && entry.scope === 'owner' && entry.kind === 'house-owner-exact-finalize'
            && entry.recorded === true && entry.error == null);
        const universe = (residency.ownerUniverses || []).find((entry) =>
          entry.key === key && entry.house > 0);
        const settled = current.physical && progress.ownerQueue.length === 0
          && progress.ownerExactQueue.length === 0
          && progress.ownerRecorded && progress.ownerExactRecorded
          && progress.ownerCovered.size === progress.ownerUniverse.size
          && progress.ownerExactCovered.size === progress.ownerExactUniverse.size
          && universe?.covered === universe?.total
          && universe?.exactCovered === universe?.exactTotal
          && finalizer && current.target?.generation === generation
          && current.target.status === 'ready' && current.target.warmed === 1
          && current.target.current === true && current.ownerCertified === false;
        if (settled) return { ...current, waitedMs: performance.now() - startedAt };
        const nextSignature = JSON.stringify(current);
        if (nextSignature !== signature) {
          signature = nextSignature;
          progressDeadline = performance.now() + 30000;
        } else if (performance.now() >= progressDeadline) {
          throw new Error(`context recovery owner settlement made no progress: ${label}: ${nextSignature}`);
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      throw new Error(`context recovery owner settlement exceeded 240s: ${label}: ${JSON.stringify(snapshot())}`);
    };
    const summarizeRestoreProbe = (probe) => {
      const frames = probe.frames.filter((frame) => frame.at >= probe.restoredAt
        && (probe.completedAt == null || frame.at <= probe.completedAt));
      const startIntervals = frames.slice(1).map((frame, index) => frame.at - frames[index].at);
      const completionIntervals = frames.slice(1)
        .map((frame, index) => frame.completedAt - frames[index].completedAt);
      const interRenderIdle = frames.slice(1)
        .map((frame, index) => frame.at - frames[index].completedAt);
      const orderingErrors = frames
        .filter((frame) => frame.generation !== probe.generation
          || frame.completedAt < frame.at)
        .map((frame) => ({ current: frame, probeGeneration: probe.generation }));
      orderingErrors.push(...frames.slice(1).flatMap((frame, index) => {
        const previous = frames[index];
        return frame.frameId > previous.frameId
          && frame.generation === probe.generation
          && previous.generation === probe.generation
          && frame.completedAt >= frame.at && previous.completedAt >= previous.at
          ? [] : [{ previous, current: frame, probeGeneration: probe.generation }];
      }));
      const firstWorld = frames.find((frame) => frame.worldDrawCalls > 0 && !frame.shielded) || null;
      const firstFull = frames.find((frame) => frame.worldDrawCalls > 0
        && !frame.shielded && !frame.reducedDetail) || null;
      const reducedFrames = frames.filter((frame) => frame.reducedDetail && frame.worldDrawCalls > 0);
      const firstShield = frames.find((frame) => frame.shielded) || null;
      const firstUnshield = firstShield
        ? frames.find((frame) => !frame.shielded && frame.at >= firstShield.at)
        : firstWorld;
      return {
        label: probe.label,
        restoredAt: probe.restoredAt,
        firstWorldMs: firstWorld ? firstWorld.at - probe.restoredAt : null,
        firstFullMs: firstFull ? firstFull.at - probe.restoredAt : null,
        worldSubmitted: !!firstWorld,
        fullWorldSubmitted: !!firstFull,
        reducedFrames: reducedFrames.length,
        shieldFrames: frames.filter((frame) => frame.shielded).length,
        reducedRetainedImpactPrime: reducedFrames
          .every((frame) => frame.impactPrime && frame.impactVisible),
        reducedRetainedFlamePrime: reducedFrames
          .every((frame) => frame.flamePrime
            && frame.flameEmberVisible && frame.flameSparkVisible),
        afterFullSubmission: probe.afterFullSubmission,
        exactPass: probe.exactPass,
        shieldDurationMs: firstShield
          ? (firstUnshield?.at || performance.now()) - firstShield.at : 0,
        frameCount: frames.length,
        orderingErrors,
        maxRafMs: Math.max(0, ...startIntervals),
        maxRenderStartIntervalMs: Math.max(0, ...startIntervals),
        maxInterRenderIdleMs: Math.max(0, ...interRenderIdle),
        maxRenderCompletionIntervalMs: Math.max(0, ...completionIntervals),
        maxRenderMs: Math.max(0, ...frames.map((frame) => frame.ms)),
        maxVisibleProgramDelta: Math.max(0, ...frames
          .filter((frame) => !frame.shielded).map((frame) => frame.programDelta)),
        maxVisibleTextureDelta: Math.max(0, ...frames
          .filter((frame) => !frame.shielded).map((frame) => frame.textureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...frames
          .filter((frame) => !frame.shielded).map((frame) => frame.geometryDelta)),
        firstWorld,
        firstFull,
      };
    };

    // 1. Invalidate a warmup which has not begun.
    await contextEvent('webglcontextlost', () => lose.loseContext());
    stages.push(mark('lost-before-warmup'));
    await restoreContext();
    await waitFor(() => g.shaderWarmup?.status === 'scheduled', 'scheduled after first restore');
    stages.push(mark('restored-before-start'));

    // 2. Wake immediately, then invalidate while compiler/targets are pending.
    F.start();
    // Context recovery is a renderer test. Freeze simulation between the
    // explicit F.stepWith calls so Choir age/director timers cannot counterfeit
    // a warmup state mutation while we wait for asynchronous GL work.
    g._selfStep = false;
    const afterStart = state();
    await waitFor(() => g.shaderWarmup?.status === 'pending', 'pending generation');
    stages.push(mark('pending-before-loss'));
    const recoveredHouseFrames = [];
    let captureRecoveredHouse = false;
    const realRecoveredHouseRender = g.render;
    g.render = function measuredRecoveredHouseRender(...args) {
      const beforePrograms = g.renderer.info.programs?.length || 0;
      const beforeTextures = g.renderer.info.memory.textures;
      const beforeGeometries = g.renderer.info.memory.geometries;
      const at = performance.now();
      const rendered = realRecoveredHouseRender.apply(this, args);
      const reducedDetail = !!g.lastRender?.reducedDetail;
      const alreadyCapturedKind = recoveredHouseFrames.some((frame) =>
        frame.reducedDetail === reducedDetail);
      if (captureRecoveredHouse && !g._shaderTransitionShield
          && g.lastRender?.worldDrawCalls > 0 && !alreadyCapturedKind) {
        const worldLights = [];
        g.scene.traverseVisible((object) => {
          if (object.isLight && (object.layers.mask & 3) !== 0) worldLights.push(object);
        });
        const lightTypes = worldLights.reduce((out, light) => {
          out[light.type] = (out[light.type] || 0) + 1;
          if (light.castShadow) {
            out.totalShadows = (out.totalShadows || 0) + 1;
            if (light.isDirectionalLight) out.directionalShadows =
              (out.directionalShadows || 0) + 1;
          }
          return out;
        }, { totalShadows: 0, directionalShadows: 0 });
        recoveredHouseFrames.push({
          ms: performance.now() - at,
          beforePrograms,
          afterPrograms: g.renderer.info.programs?.length || 0,
          beforeTextures,
          afterTextures: g.renderer.info.memory.textures,
          beforeGeometries,
          afterGeometries: g.renderer.info.memory.geometries,
          drawCalls: g.lastRender.drawCalls,
          worldDrawCalls: g.lastRender.worldDrawCalls,
          heldDrawCalls: g.lastRender.heldDrawCalls,
          reducedDetail,
          residencyKey: g.lastRender.residencyKey || null,
          visibleProgramDelta: g.lastRender.visibleProgramDelta || 0,
          visibleTextureDelta: g.lastRender.visibleTextureDelta || 0,
          visibleGeometryDelta: g.lastRender.visibleGeometryDelta || 0,
          worldLights: worldLights.length,
          lightTypes,
        });
      }
      return rendered;
    };
    await contextEvent('webglcontextlost', () => lose.loseContext());
    stages.push(mark('lost-during-warmup'));
    const houseRestoreProbe = beginRestoreProbe('house');
    await restoreContext();
    markRestored(houseRestoreProbe);
    captureRecoveredHouse = true;
    await waitForRestoreReveal(houseRestoreProbe);
    await waitForRestoreExact(houseRestoreProbe, { keepActive: true });
    await waitFor(() => recoveredHouseFrames.some((frame) => !frame.reducedDetail),
      'first exact recovered house frame');
    await waitForShaderReady({
      label: 'ready after pending loss', probe: houseRestoreProbe,
    });
    houseRestoreProbe.completedAt = performance.now();
    if (activeRestoreProbe === houseRestoreProbe) activeRestoreProbe = null;
    g.render = realRecoveredHouseRender;
    stages.push(mark('ready-after-pending-loss'));
    const afterPendingRecovery = state();
    const measureHouseView = async (kind) => {
      const setupStartedAt = performance.now();
      F.teleport('house');
      if (g.act !== 'house') throw new Error(`${kind} view landed in ${g.act}, not house`);
      g.skull.holdNow();
      if (kind === 'window') {
        g.houseMirror.awakened = false;
        const opening = g.world.windowOpenings.find((entry) => entry.id === 'livingRelayWindow')
          || g.world.windowOpenings[0];
        const dx = opening.center.x - (opening.center.x - opening.normal.x * 2.1);
        const dz = opening.center.z - (opening.center.z - opening.normal.z * 2.1);
        g.player.pos.set(opening.center.x - opening.normal.x * 2.1, 0,
          opening.center.z - opening.normal.z * 2.1);
        g.player.yaw = Math.atan2(-dx, -dz);
        g.player.pitch = 0;
      } else if (kind === 'mirror') {
        for (const key of [...(g.currentGpuResidency?.owners || [])]) {
          if (key.includes(':house:')) g.currentGpuResidency.owners.delete(key);
        }
        g.houseMirror.awakened = true;
        g.player.pos.set(g.houseMirror.pos.x + 2.1, 0, g.houseMirror.pos.z);
        g.player.yaw = Math.PI / 2;
        g.player.pitch = 0;
      } else {
        const mirror = g.houseMirror.pos;
        g.houseMirror.awakened = true;
        g.player.pos.set(mirror.x + 1.7, 0, mirror.z + 1.1);
        const dx = mirror.x - g.player.pos.x;
        const dz = mirror.z - g.player.pos.z;
        g.player.yaw = Math.atan2(-dx, -dz);
        g.player.pitch = -0.04;
      }
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      const setupMs = performance.now() - setupStartedAt;
      const before = {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      };
      const ownerPassIndex = g.currentGpuResidency?.ownerPasses?.length || 0;
      const timing = await sampleOwnedFrames({
        count: 9,
        label: `restored-house-${kind}`,
        generation: g._webglGeneration,
        key: g._currentGpuResidencyKey(),
      });
      const visibleFrames = timing.frames.map((frame) => ({
        ...frame,
        programDelta: frame.programDelta,
        textureDelta: frame.textureDelta,
        geometryDelta: frame.geometryDelta,
        residencyKey: frame.key,
        paneActive: frame.housePaneActive,
        mirrorActive: frame.houseMirrorActive,
      }));
      g._syncShaderBallast();
      return {
        kind,
        setupMs,
        before,
        after: {
          programs: g.renderer.info.programs?.length || 0,
          textures: g.renderer.info.memory.textures,
          geometries: g.renderer.info.memory.geometries,
        },
        renderCount: timing.frames.length,
        orderingErrors: timing.orderingErrors,
        observedIntervals: timing.observedIntervals,
        maxRafMs: timing.maxObservedIntervalMs,
        maxRenderMs: timing.maxRenderMs,
        maxRenderStartIntervalMs: timing.maxRenderStartIntervalMs,
        maxInterRenderIdleMs: timing.maxInterRenderIdleMs,
        maxRenderCompletionIntervalMs: timing.maxRenderCompletionIntervalMs,
        reducedFrames: visibleFrames.filter((frame) => frame.reducedDetail).length,
        maxVisibleProgramDelta: Math.max(0, ...visibleFrames.map((frame) => frame.programDelta)),
        maxVisibleTextureDelta: Math.max(0, ...visibleFrames.map((frame) => frame.textureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...visibleFrames.map((frame) => frame.geometryDelta)),
        firstOwnerPassFrame: visibleFrames.find((frame) =>
          frame.ownerPassesAdded?.some((entry) => entry.kind === 'house')) || null,
        firstEnabledFrame: visibleFrames.find((frame) => frame.paneActive) || null,
        ownerPasses: [...(g.currentGpuResidency?.ownerPasses || [])].slice(ownerPassIndex),
        mirrorActive: g.houseMirror.active,
        paneActive: g.houseMirror.pane.active,
        reflectionLightCensus: kind !== 'window' && g.houseMirror.pane.active
          ? lightCensus(g.houseMirror.pool._vcam) : null,
        targetState: g._houseMirrorTargetWarmState ? {
          status: g._houseMirrorTargetWarmState.status,
          generation: g._houseMirrorTargetWarmState.generation,
          warmed: g._houseMirrorTargetWarmState.warmed,
          targetUuid: g._houseMirrorTargetWarmState.targetUuid,
          current: g._houseMirrorTargetWarmState.targetRef === g.houseMirror?.pool?.pool?.[0]
            && g._houseMirrorTargetWarmState.targetUuid
              === g.houseMirror?.pool?.pool?.[0]?.texture?.uuid,
        } : null,
      };
    };
    // Preserve the immediate destination transition sample, then let this exact
    // House physical key finish its hidden owner universe while the window keeps
    // the mirror ineligible. A Bedroom proof from the restored Wake is not a
    // House proof: physical districts intentionally retire one another.
    const restoredHouseWindow = await measureHouseView('window');
    const restoredHouseGeneration = g._webglGeneration;
    const restoredHouseKey = g._currentGpuResidencyKey();
    const restoredHouseSettlement = await waitForCurrentHouseOwnerSettlement({
      label: 'restored House destination owner universe',
      generation: restoredHouseGeneration,
      key: restoredHouseKey,
    });
    const restoredHouseMirror = await measureHouseView('mirror');
    const restoredHouseMotion = await measureHouseView('mirror-motion');
    const restoredHouseViews = [
      restoredHouseWindow, restoredHouseMirror, restoredHouseMotion,
    ];
    const restoredHouseOwnerUniverses = [...(g.currentGpuResidency?.ownerUniverses || [])]
      .filter((entry) => entry.key === restoredHouseKey);
    const restoredHouseOwnerBatches = [...(g.currentGpuResidency?.reducedPasses || [])]
      .filter((entry) => entry.generation === restoredHouseGeneration
        && entry.key === restoredHouseKey && entry.kind === 'owner-preload-batch');
    const restoredHouseOwnerExactBatches = [...(g.currentGpuResidency?.exactPreloadPasses || [])]
      .filter((entry) => entry.generation === restoredHouseGeneration
        && entry.key === restoredHouseKey && entry.kind === 'owner-exact-preload-batch'
        && entry.targetOwner === 'house');
    const restoredHouseFinalizers = [...(g.currentGpuResidency?.universeFinalizePasses || [])]
      .filter((entry) => entry.generation === restoredHouseGeneration
        && entry.key === restoredHouseKey && entry.kind === 'house-owner-exact-finalize');
    const restoredImpactBefore = {
      programs: g.renderer.info.programs?.length || 0,
      textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries,
      lightUuid: g._impactLight?.uuid || null,
      ringUuid: g._impactRing?.uuid || null,
    };
    const restoredImpactStartedAt = performance.now();
    g.impact('locked', g.player.pos.clone().setY(g.player.pos.y + 1));
    const restoredImpactActivation = {
      ringVisible: !!g._impactRing?.visible,
      bootPrime: !!g._impactRing?.userData?.bootPrime,
      ringT: g._ringT,
      ringIn: !!g._ringIn,
      lightIntensity: g._impactLight?.intensity || 0,
      hitStop: g.hitStop || 0,
    };
    const restoredImpactSetupMs = performance.now() - restoredImpactStartedAt;
    const restoredImpactTiming = await sampleOwnedFrames({
      count: 5,
      label: 'restored-house-impact',
      generation: g._webglGeneration,
      key: g._currentGpuResidencyKey(),
    });
    const restoredImpact = {
      before: restoredImpactBefore,
      activation: restoredImpactActivation,
      setupMs: restoredImpactSetupMs,
      after: {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
        lightUuid: g._impactLight?.uuid || null,
        ringUuid: g._impactRing?.uuid || null,
      },
      timing: restoredImpactTiming,
      maxRafMs: restoredImpactTiming.maxObservedIntervalMs,
      bootPrime: !!g._impactRing?.userData?.bootPrime,
    };
    const activateDormantPool = (mesh, offset) => {
      g._goreMatrix.identity().setPosition(
        g.player.pos.x + offset, g.player.pos.y + 0.5, g.player.pos.z - 1.5,
      );
      mesh.setMatrixAt(0, g._goreMatrix);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.count = 1;
      mesh.visible = true;
    };
    const dynamicBefore = {
      programs: g.renderer.info.programs?.length || 0,
      textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries,
      goreCount: g.goreMesh.count,
      stainCount: g.enemies.stainPool.count,
    };
    const dynamicSetupStartedAt = performance.now();
    activateDormantPool(g.goreMesh, -0.15);
    activateDormantPool(g.enemies.stainPool, 0.15);
    const dynamicSetupMs = performance.now() - dynamicSetupStartedAt;
    const dynamicTiming = await sampleOwnedFrames({
      count: 5,
      label: 'restored-house-dynamic-pools',
      generation: g._webglGeneration,
      key: g._currentGpuResidencyKey(),
    });
    const dynamicPoolActivation = {
      before: dynamicBefore,
      setupMs: dynamicSetupMs,
      after: {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
        goreCount: g.goreMesh.count,
        stainCount: g.enemies.stainPool.count,
      },
      timing: dynamicTiming,
      maxRafMs: dynamicTiming.maxObservedIntervalMs,
    };
    g.goreMesh.count = 0;
    g.goreMesh.visible = false;
    g.enemies.stainPool.count = 0;
    g.enemies.stainPool.visible = false;

    // Context restoration while the skull is genuinely outbound is the parent
    // edge that a held-only preload cannot cover. Freeze simulation after the
    // real throw, restore the GL generation, and require both story/flight state
    // and every future skull-stage resource to survive unchanged.
    g.skull.holdNow();
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    if (g.skull.mode !== 'outbound' || g.skull.root.parent !== g.scene) {
      throw new Error('outbound context probe failed to launch skull into world');
    }
    const outboundBefore = skullFlightState();
    await contextEvent('webglcontextlost', () => lose.loseContext());
    stages.push(mark('lost-with-outbound-skull'));
    const outboundRestoreProbe = beginRestoreProbe('outbound-skull');
    await restoreContext();
    markRestored(outboundRestoreProbe);
    await waitForRestoreReveal(outboundRestoreProbe);
    await waitForRestoreExact(outboundRestoreProbe, { keepActive: true });
    await waitForShaderReady({
      label: 'ready after outbound skull loss', probe: outboundRestoreProbe,
    });
    outboundRestoreProbe.completedAt = performance.now();
    if (activeRestoreProbe === outboundRestoreProbe) activeRestoreProbe = null;
    const outboundAfter = skullFlightState();
    const outboundResidency = {
      reducedPasses: [...(g.currentGpuResidency?.reducedPasses || [])],
      exactPasses: [...(g.currentGpuResidency?.exactPasses || [])],
      exactPreloadPasses: [...(g.currentGpuResidency?.exactPreloadPasses || [])],
      skullWorldPasses: [...(g.currentGpuResidency?.skullWorldPasses || [])],
      errors: [...(g.currentGpuResidency?.errors || [])],
    };
    stages.push(mark('ready-after-outbound-skull-loss'));
    g.skull.holdNow();
    const restoredOssuarySeam = await measureAct(
      'ossuary', 'ossuary-before-sacrifice-after-restore',
    );

    // 3. Install the authored post-waterfall state as a renderer fixture, then
    // restore with a real live Choir. Its owned light must be isolated from
    // ordinary/finale rigs while still contributing the cave-threat signature.
    // This is the exact late-game state a context loss can interrupt in play.
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('cave');
    if (g.act !== 'cave') throw new Error(`live-Choir fixture landed in ${g.act}, not cave`);
    F.stepWith(0.05, {}, false);
    const choirSource = g.director._caveEcology?.choirSource
      || g.underfalls.layout.main[5];
    g.enemies.beginDrownedChoir({ pos: choirSource, heardPos: g.player.pos });
    const liveChoirBefore = state();
    await contextEvent('webglcontextlost', () => lose.loseContext());
    stages.push(mark('lost-with-live-choir'));
    const caveRestoreProbe = beginRestoreProbe('cave');
    await restoreContext();
    markRestored(caveRestoreProbe);
    await waitForRestoreReveal(caveRestoreProbe);
    await waitForRestoreExact(caveRestoreProbe, { keepActive: true });
    await waitForShaderReady({
      label: 'ready after live Choir loss', probe: caveRestoreProbe,
    });
    caveRestoreProbe.completedAt = performance.now();
    if (activeRestoreProbe === caveRestoreProbe) activeRestoreProbe = null;
    stages.push(mark('ready-after-live-choir-loss'));
    const afterReadyRecovery = state();

    async function measureAct(act, label = act) {
      const setupStartedAt = performance.now();
      if (act === 'cave' && !g.flags.has('waterfallTaken')) g.director.waterfallTaken();
      if (act === 'ossuary') {
        F.teleport('graveyard');
        F.stepWith(0.05, {}, false);
        const ossuary = g.ossuary;
        ossuary.unlock('context-warmup-regression');
        g.enemies.clear();
        if (g.skull.mode !== 'gone') g.skull.holdNow();
        const connector = ossuary.entranceConnector;
        g.player.pos.set(
          g.ritualMausoleum.x,
          ossuary.origin.floor + 0.34,
          connector.portalZ + 0.08,
        );
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        F.stepWith(1 / 120, {}, false);
        if (!ossuary.inOssuary) throw new Error('restored physical ossuary entry did not cross');
      } else {
        F.teleport(act);
        F.stepWith(0.05, {}, false);
      }
      if (act === 'ossuary') {
        if (g.act !== 'graveyard' || !g.ossuary.inOssuary) {
          throw new Error(`restored ossuary seam landed in ${g.act} without ossuary ownership`);
        }
      } else if (g.act !== act) {
        throw new Error(`restored ${label} seam landed in ${g.act}, not ${act}`);
      }
      if (act === 'cave') {
        // Put the cold first visible frame on the authored hatch approach. This
        // proves the destination signal and late-route materials were warmed,
        // not merely the waterfall entrance around the debug spawn.
        const route = g.underfalls.layout.main;
        const approach = route[route.length - 2];
        const hatch = route[route.length - 1];
        g.player.pos.set(approach.x, g.underfalls.groundAt(approach.x, approach.z), approach.z);
        g.player.yaw = Math.atan2(-(hatch.x - approach.x), -(hatch.z - approach.z));
        g.player.pitch = -0.08;
        g.player._sync(0);
      }
      const before = {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      };
      const setupMs = performance.now() - setupStartedAt;
      const timing = await sampleOwnedFrames({
        count: 17,
        label: `restored-context-${label}`,
        generation: g._webglGeneration,
        key: g._currentGpuResidencyKey(),
      });
      const visibleFrames = timing.frames;
      const result = {
        act,
        label,
        setupMs,
        before,
        after: {
          programs: g.renderer.info.programs?.length || 0,
          textures: g.renderer.info.memory.textures,
          geometries: g.renderer.info.memory.geometries,
        },
        renderCount: timing.frames.length,
        orderingErrors: timing.orderingErrors,
        observedIntervals: timing.observedIntervals,
        maxRafMs: timing.maxObservedIntervalMs,
        maxRenderMs: timing.maxRenderMs,
        maxRenderStartIntervalMs: timing.maxRenderStartIntervalMs,
        maxInterRenderIdleMs: timing.maxInterRenderIdleMs,
        maxRenderCompletionIntervalMs: timing.maxRenderCompletionIntervalMs,
        worldSubmitted: visibleFrames.some((frame) => frame.worldDrawCalls > 0),
        shielded: visibleFrames.some((frame) => frame.shielded),
        reducedFrames: visibleFrames.filter((frame) => frame.reducedDetail).length,
        maxVisibleProgramDelta: Math.max(0, ...visibleFrames.map((frame) => frame.programDelta)),
        maxVisibleTextureDelta: Math.max(0, ...visibleFrames.map((frame) => frame.textureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...visibleFrames.map((frame) => frame.geometryDelta)),
        residencyKey: visibleFrames.at(-1)?.key || null,
      };
      g._syncShaderBallast();
      const worldLights = [];
      g.scene.traverseVisible((object) => {
        if (object.isLight && (object.layers.mask & 3) !== 0) worldLights.push(object);
      });
      result.worldLights = worldLights.length;
      result.lightTypes = worldLights.reduce((out, light) => {
        out[light.type] = (out[light.type] || 0) + 1;
        if (light.castShadow) {
          out.totalShadows = (out.totalShadows || 0) + 1;
          if (light.isDirectionalLight) out.directionalShadows =
            (out.directionalShadows || 0) + 1;
        }
        return out;
      }, { totalShadows: 0, directionalShadows: 0 });
      result.ballastViolations = worldLights.filter((light) =>
        light.userData?.fetchShaderBallast && (
          light.intensity !== 0
          || ((light.isPointLight || light.isSpotLight) && light.castShadow)
          || (light.isDirectionalLight && !light.castShadow)
        )).map((light) => light.name);
      result.cleanupMs = 0;
      if (act === 'ossuary') {
        const cleanupStartedAt = performance.now();
        for (let index = 0; index < 15 && g.ossuary.portalCooldown > 0; index++) {
          F.stepWith(0.04, {}, false);
        }
        g.player.pos.set(g.ossuary.origin.x, g.ossuary.origin.floor,
          g.ossuary.origin.z + 0.2);
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        F.stepWith(1 / 120, {}, false);
        if (g.ossuary.inOssuary || g.ossuary.root.visible) {
          throw new Error('restored ossuary backtrack did not restore the graveyard');
        }
        result.cleanupMs = performance.now() - cleanupStartedAt;
      }
      return result;
    }
    const seams = [
      await measureAct('cave', 'hatch-with-live-choir'),
      restoredOssuarySeam,
      await measureAct('graveyard', 'graveyard-after-restore'),
      await measureAct('forest', 'forest-after-restore'),
      await measureAct('clearing', 'clearing-after-restore'),
      await measureAct('mirror', 'mirror-after-choir-retirement'),
    ];

    // 4. Lose the context after Finale.begin has mounted the exact skull. The
    // panes must stay dark-but-live while the new generation warms, then the
    // very first real reflection must allocate/compile nothing. Instrument the
    // first unsuppressed Finale.render call rather than sampling a later frame.
    const activeFinaleBefore = state();
    const finaleOwnerPassIndex = g.currentGpuResidency?.ownerPasses?.length || 0;
    const reflectionFrames = [];
    let recordReflections = false;
    const realFinaleRender = g.finale.render;
    g.finale.render = function measuredFinaleRender(...args) {
      const beforePrograms = g.renderer.info.programs?.length || 0;
      const beforeTextures = g.renderer.info.memory.textures;
      const beforeGeometries = g.renderer.info.memory.geometries;
      const startedAt = performance.now();
      const rendered = realFinaleRender.apply(this, args);
      if (recordReflections && rendered) {
        reflectionFrames.push({
          ms: performance.now() - startedAt,
          beforePrograms,
          afterPrograms: g.renderer.info.programs?.length || 0,
          beforeTextures,
          afterTextures: g.renderer.info.memory.textures,
          beforeGeometries,
          afterGeometries: g.renderer.info.memory.geometries,
        });
      }
      return rendered;
    };
    await contextEvent('webglcontextlost', () => lose.loseContext());
    stages.push(mark('lost-with-active-finale'));
    if (!g.finale._contextRewarming) throw new Error('active Finale was not shielded on context loss');
    const finaleRestoreProbe = beginRestoreProbe('active-finale');
    await restoreContext();
    markRestored(finaleRestoreProbe);
    recordReflections = true;
    await waitForRestoreReveal(finaleRestoreProbe);
    await waitForRestoreExact(finaleRestoreProbe, { keepActive: true });
    await waitForShaderReady({
      label: 'active Finale generation ready', probe: finaleRestoreProbe,
      extra: () => g.finale._targetWarmState?.status === 'ready'
        && !g.finale._contextRewarming,
      terminal: () => {
        const target = g.finale._targetWarmState;
        if (!target) return null;
        if (target.generation !== g._webglGeneration) return 'target generation mismatch';
        if (['skipped', 'invalidated'].includes(target.status)) {
          return `target ${target.status}`;
        }
        if (target.status === 'degraded' && !target.recoveryScheduled) {
          return 'target degraded without recovery';
        }
        if (g.shaderWarmup?.status === 'ready' && target.status === 'ready'
            && g.finale._contextRewarming) {
          return 'ready target left context rewarming latched';
        }
        return null;
      },
    });
    await waitFor(() => reflectionFrames.length > 0, 'first restored reflection');
    await waitFor(() => finaleRestoreProbe.frames.some((frame) =>
      frame.at >= finaleRestoreProbe.restoredAt && frame.finalePanesActive > 0),
    'first restored Finale pane frame');
    finaleRestoreProbe.completedAt = performance.now();
    if (activeRestoreProbe === finaleRestoreProbe) activeRestoreProbe = null;
    g._syncShaderBallast();
    const finaleReflectionLightCensus = lightCensus(g.finale.mirrors._vcam);
    const finaleMotionFrameIndex = reflectionFrames.length;
    const finaleMotionOwnerBefore = g.currentGpuResidency?.ownerPasses?.length || 0;
    const finaleMotionBefore = {
      programs: g.renderer.info.programs?.length || 0,
      textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries,
    };
    g.player.pos.x += 0.28;
    g.player.pos.z -= 0.22;
    g.player.yaw += 0.42;
    g.player.pitch = -0.03;
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    const finaleMotionTiming = await sampleOwnedFrames({
      count: 4,
      label: 'active-finale-motion',
      generation: g._webglGeneration,
      key: g._currentGpuResidencyKey(),
    });
    const finaleMotionFrames = reflectionFrames.slice(finaleMotionFrameIndex);
    const finaleMirrorMotion = {
      before: finaleMotionBefore,
      after: {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      },
      frames: finaleMotionFrames,
      timing: finaleMotionTiming,
      maxRafMs: finaleMotionTiming.maxObservedIntervalMs,
      ownerBefore: finaleMotionOwnerBefore,
      ownerAfter: g.currentGpuResidency?.ownerPasses?.length || 0,
      panesActive: g.finale.panes.filter((pane) => pane.active).length,
      reflectionLightCensus: lightCensus(g.finale.mirrors._vcam),
    };
    stages.push(mark('ready-after-active-finale-loss'));
    g.finale.render = realFinaleRender;
    const afterActiveFinaleRecovery = state();
    const firstRestoredReflection = reflectionFrames[0];
    const restoredFinaleOwnerPasses = [...(g.currentGpuResidency?.ownerPasses || [])]
      .slice(finaleOwnerPassIndex).filter((entry) => entry.kind === 'finale');
    const restoredFinaleOwnerUniverses = [...(g.currentGpuResidency?.ownerUniverses || [])];
    const restoredFinaleOwnerBatches = [...(g.currentGpuResidency?.reducedPasses || [])]
      .filter((entry) => entry.kind === 'owner-preload-batch');
    const restoredFinaleOwnerExactBatches = [...(g.currentGpuResidency?.exactPreloadPasses || [])]
      .filter((entry) => entry.kind === 'owner-exact-preload-batch'
        && entry.targetOwner === 'finale');
    const restoredFinaleFinalizers = [...(g.currentGpuResidency?.universeFinalizePasses || [])]
      .filter((entry) => entry.kind === 'finale-owner-exact-finalize');
    const activeRestoreSummary = summarizeRestoreProbe(finaleRestoreProbe);
    const firstFinalePaneFrame = finaleRestoreProbe.frames.find((frame) =>
      frame.at >= finaleRestoreProbe.restoredAt && frame.finalePanesActive > 0) || null;
    activeRestoreProbe = null;
    g.render = originalGameRender;

    // 5. A driver/FBO bind failure is not a warmed target. Force the first
    // target to fail persistently, prove retries are bounded and the active
    // Finale stays behind dark glass, then install a clean target generation
    // and prove the shield and panes recover deterministically.
    const renderer = g.renderer;
    const originalSetRenderTarget = renderer.setRenderTarget;
    const target0 = g.finale.mirrors.pool[0];
    g.finale.beginContextRewarm(g._webglGeneration);
    g.finale.invalidateWarmRenderTargets('injected-bind-failure');
    let injectedAttempts = 0;
    renderer.setRenderTarget = function injectedTargetFailure(target, ...args) {
      if (target === target0) {
        injectedAttempts++;
        throw new Error('injected mirror target bind failure');
      }
      return originalSetRenderTarget.call(this, target, ...args);
    };
    const failedTargetState = await new Promise((resolve) => {
      g.finale.warmRenderTargets(resolve);
    });
    const failedRelease = g.finale.completeContextRewarm(g._webglGeneration);
    const failedRender = g.finale.render(g.scene, g.camera);
    const failedRewarming = g.finale._contextRewarming;
    const failedPanesActive = g.finale.panes.map((pane) => pane.active);
    renderer.setRenderTarget = originalSetRenderTarget;

    await waitFor(() => g.finale._targetWarmState !== failedTargetState
      && g.finale._targetWarmState?.status === 'ready',
    'same-generation Finale target recovery');
    const recoveredTargetState = g.finale._targetWarmState;
    const recoveredRelease = g.finale.completeContextRewarm(g._webglGeneration);
    const recoveredPanesActive = g.finale.panes.map((pane) => pane.active);
    const failureRecovery = {
      injectedAttempts,
      failed: {
        generation: failedTargetState.generation,
        status: failedTargetState.status,
        warmed: failedTargetState.warmed,
        attempts: [...failedTargetState.attempts],
        failedTargets: [...failedTargetState.failedTargets],
        errors: [...failedTargetState.errors],
        release: failedRelease,
        render: failedRender,
        rewarming: failedRewarming,
        panesActive: failedPanesActive,
      },
      recovered: {
        generation: recoveredTargetState.generation,
        status: recoveredTargetState.status,
        warmed: recoveredTargetState.warmed,
        attempts: [...recoveredTargetState.attempts],
        failedTargets: [...recoveredTargetState.failedTargets],
        release: recoveredRelease,
        released: recoveredRelease || (!g.finale._contextRewarming
          && recoveredPanesActive.every((active) => active)),
        rewarming: g.finale._contextRewarming,
        panesActive: recoveredPanesActive,
      },
    };

    // Reading the currently-bound FBO is part of the target warm attempt too.
    // A driver can fail before bind; that must consume the same bounded retry,
    // resolve the callback as degraded (never hang pending), keep the physical
    // ending visible behind dark glass, then self-heal without another loss.
    g.finale.beginContextRewarm(g._webglGeneration);
    g.finale.invalidateWarmRenderTargets('injected-read-target-failure');
    const originalGetRenderTarget = renderer.getRenderTarget;
    const originalSelfStep = g._selfStep;
    let injectedReadAttempts = 0;
    // Scope the injected driver read fault to the warmer itself. Letting the
    // ordinary self-stepping render loop call the patched getter would create
    // an unrelated pageerror and counterfeit a live renderer failure.
    g._selfStep = false;
    g.render = () => {};
    renderer.getRenderTarget = function injectedReadTargetFailure(...args) {
      if (injectedReadAttempts < 2) {
        injectedReadAttempts++;
        throw new Error('injected mirror target read failure');
      }
      return originalGetRenderTarget.apply(this, args);
    };
    let readFailedTargetState;
    try {
      readFailedTargetState = await new Promise((resolve) => {
        g.finale.warmRenderTargets(resolve);
      });
    } finally {
      renderer.getRenderTarget = originalGetRenderTarget;
      g.render = originalGameRender;
      g._selfStep = originalSelfStep;
    }
    const readFailedRelease = g.finale.completeContextRewarm(g._webglGeneration);
    let readFailedEscaped = null;
    try { g.render(); } catch (error) { readFailedEscaped = error?.message || `${error}`; }
    const readFailedWorld = {
      drawCalls: g.lastRender?.drawCalls || 0,
      worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
      shielded: !!g._shaderTransitionShield,
      panesActive: g.finale.panes.map((pane) => pane.active),
      rewarming: g.finale._contextRewarming,
    };
    await waitFor(() => g.finale._targetWarmState !== readFailedTargetState
      && g.finale._targetWarmState?.status === 'ready',
    'same-generation Finale read-target recovery');
    const readRecoveredTargetState = g.finale._targetWarmState;
    const readRecoveredRelease = g.finale.completeContextRewarm(g._webglGeneration);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const readFailureRecovery = {
      injectedReadAttempts,
      failed: {
        generation: readFailedTargetState.generation,
        status: readFailedTargetState.status,
        warmed: readFailedTargetState.warmed,
        attempts: [...readFailedTargetState.attempts],
        failedTargets: [...readFailedTargetState.failedTargets],
        errors: [...readFailedTargetState.errors],
        release: readFailedRelease,
        escaped: readFailedEscaped,
        ...readFailedWorld,
      },
      recovered: {
        generation: readRecoveredTargetState.generation,
        status: readRecoveredTargetState.status,
        warmed: readRecoveredTargetState.warmed,
        failedTargets: [...readRecoveredTargetState.failedTargets],
        release: readRecoveredRelease,
        released: readRecoveredRelease || (!g.finale._contextRewarming
          && g.finale.panes.every((pane) => pane.active)),
        rewarming: g.finale._contextRewarming,
        panesActive: g.finale.panes.map((pane) => pane.active),
      },
    };
    return {
      supported: true,
      stages,
      afterStart,
      afterPendingRecovery,
      firstRecoveredHouseFrame: recoveredHouseFrames[0],
      firstRecoveredHouseFullFrame: recoveredHouseFrames
        .find((frame) => !frame.reducedDetail),
      restoredHouseGeneration,
      restoredHouseKey,
      restoredHouseSettlement,
      restoredHouseViews,
      restoredHouseOwnerUniverses,
      restoredHouseOwnerBatches,
      restoredHouseOwnerExactBatches,
      restoredHouseFinalizers,
      restoredImpact,
      dynamicPoolActivation,
      outboundBefore,
      outboundAfter,
      outboundResidency,
      liveChoirBefore,
      afterReadyRecovery,
      seams,
      activeFinaleBefore,
      afterActiveFinaleRecovery,
      firstRestoredReflection,
      finaleReflectionLightCensus,
      finaleMirrorMotion,
      finaleOwnerPasses: restoredFinaleOwnerPasses,
      finaleOwnerUniverses: restoredFinaleOwnerUniverses,
      finaleOwnerBatches: restoredFinaleOwnerBatches,
      finaleOwnerExactBatches: restoredFinaleOwnerExactBatches,
      finaleFinalizers: restoredFinaleFinalizers,
      finalizerFrames,
      firstFinalePaneFrame,
      activeRestoreMaxRafMs: activeRestoreSummary.maxRenderCompletionIntervalMs,
      restoreProbes: restoreProbes.map(summarizeRestoreProbe),
      failureRecovery,
      readFailureRecovery,
    };
  });
  report.browserErrors.push(...opened.errors.map((error) => `context: ${error}`));
  await page.close();
  return value;
}

async function runHouseFailureRecovery(browser) {
  const opened = await openPage(browser, report.url);
  const { page } = opened;
  await ready(page);
  const value = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    const renderer = g.renderer;
    const gl = renderer.getContext();
    const lose = gl.getExtension('WEBGL_lose_context');
    if (!lose) return { supported: false };
    const canvas = renderer.domElement;
    const waitFor = async (predicate, label, timeout = 90000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      if (!predicate()) throw new Error(`house failure recovery timed out: ${label}`);
    };
    const contextEvent = (name, action) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`missing ${name}`)), 20000);
      canvas.addEventListener(name, () => { clearTimeout(timer); resolve(); }, { once: true });
      action();
    });
    const cycleContext = async () => {
      await contextEvent('webglcontextlost', () => lose.loseContext());
      await new Promise((resolve) => setTimeout(resolve, 50));
      await contextEvent('webglcontextrestored', () => lose.restoreContext());
    };
    const frame = async (count = 4) => {
      for (let i = 0; i < count; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    };
    const houseResidencySnapshot = () => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const key = g._currentGpuResidencyKey();
      const ownerKey = g._ownerGpuResidencyKey('house');
      return {
        generation: residency?.generation ?? null,
        key,
        activeKey: residency?.activeKey || null,
        progressKey: progress?.key || null,
        physical: residency?.physical?.has(key) || false,
        queue: progress?.queue?.length ?? null,
        ownerQueue: progress?.ownerQueue?.length ?? null,
        ownerExactQueue: progress?.ownerExactQueue?.length ?? null,
        ownerCovered: progress?.ownerCovered?.size ?? null,
        ownerTotal: progress?.ownerUniverse?.size ?? null,
        ownerExactCovered: progress?.ownerExactCovered?.size ?? null,
        ownerExactTotal: progress?.ownerExactUniverse?.size ?? null,
        ownerRecorded: !!progress?.ownerRecorded,
        ownerExactRecorded: !!progress?.ownerExactRecorded,
        ownerFinalizeBlocked: !!progress?.ownerFinalizeBlocked,
        failedOwners: progress?.failedOwners?.size ?? null,
        ownerCertified: residency?.owners?.has(ownerKey) || false,
        ownerPasses: residency?.ownerPasses?.length || 0,
        universeRecorded: (residency?.ownerUniverses || []).some((entry) =>
          entry.key === key && entry.house > 0 && entry.covered === entry.total
            && entry.exactCovered === entry.exactTotal),
        finalizerRecorded: (residency?.universeFinalizePasses || []).some((entry) =>
          entry.generation === g._webglGeneration && entry.key === key
            && entry.kind === 'house-owner-exact-finalize'
            && entry.recorded === true && entry.error == null),
      };
    };
    const resourceSnapshot = () => ({
      generation: g._webglGeneration,
      shaderStatus: g.shaderWarmup?.status,
      readyVariants: [...(g.shaderWarmup?.readyVariants || [])],
      errors: [...(g.shaderWarmup?.errors || [])],
      target: g._houseMirrorTargetWarmState ? {
        status: g._houseMirrorTargetWarmState.status,
        generation: g._houseMirrorTargetWarmState.generation,
        attempts: g._houseMirrorTargetWarmState.attempts,
        warmed: g._houseMirrorTargetWarmState.warmed,
        targetUuid: g._houseMirrorTargetWarmState.targetUuid,
        current: g._houseMirrorTargetWarmState.targetRef === g.houseMirror?.pool?.pool?.[0]
          && g._houseMirrorTargetWarmState.targetUuid
            === g.houseMirror?.pool?.pool?.[0]?.texture?.uuid,
        errors: [...g._houseMirrorTargetWarmState.errors],
      } : null,
      residency: houseResidencySnapshot(),
      drawCalls: g.lastRender?.drawCalls || 0,
      worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
      paneActive: g.houseMirror.pane.active,
      mirrorActive: g.houseMirror.active,
      shielded: !!g._shaderTransitionShield,
      reducedDetail: !!g.lastRender?.reducedDetail,
      visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
      visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
      visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
    });
    const warmRecoverySignature = (target) => {
      const shader = g.shaderWarmup;
      const activity = g._shaderCompileActivity;
      const lastJob = shader?.compileJobs?.at(-1);
      const residency = houseResidencySnapshot();
      return JSON.stringify([
        g._webglGeneration, shader?.generation, shader?.status, shader?.reason,
        shader?.recoveryRound, shader?.recoveryScheduled,
        shader?.setupSlices?.length, shader?.compileSlices?.length,
        shader?.textureSlices?.length, shader?.compileJobs?.length,
        shader?.compileInFlightLabel, shader?.compileJobsInFlight,
        lastJob?.label, lastJob?.settledMs, lastJob?.error,
        activity?.generation, activity?.active,
        shader?.currentExactKey, shader?.currentExactRevision,
        shader?.currentExactStatus, (shader?.readyVariants || []).join('|'),
        target?.generation, target?.status, target?.warmed,
        target?.recoveryRound, target?.recoveryScheduled,
        target?.attempts, target?.failedTargets?.length,
        residency.generation, residency.key, residency.activeKey, residency.progressKey,
        residency.physical, residency.queue, residency.ownerQueue,
        residency.ownerExactQueue, residency.ownerCovered, residency.ownerTotal,
        residency.ownerExactCovered, residency.ownerExactTotal,
        residency.ownerRecorded, residency.ownerExactRecorded,
        residency.ownerFinalizeBlocked, residency.failedOwners,
        residency.ownerCertified, residency.ownerPasses,
        residency.universeRecorded, residency.finalizerRecorded,
        g.houseMirror?.active, g.houseMirror?.pane?.active,
      ]);
    };
    const houseOwnerPaneReady = (generation, key) => {
      const residency = houseResidencySnapshot();
      return residency.generation === generation && residency.key === key
        && residency.activeKey === key && residency.progressKey === key
        && residency.physical === true && residency.queue === 0
        && residency.ownerQueue === 0 && residency.ownerExactQueue === 0
        && residency.ownerRecorded === true && residency.ownerExactRecorded === true
        && residency.ownerCovered === residency.ownerTotal
        && residency.ownerExactCovered === residency.ownerExactTotal
        && residency.ownerFinalizeBlocked === false && residency.failedOwners === 0
        && residency.universeRecorded === true && residency.finalizerRecorded === true
        && residency.ownerCertified === true
        && g.houseMirror?.active === true && g.houseMirror?.pane?.active === true;
    };
    const waitForWarmRecovery = async ({
      label, generation, ready: isReady, target: readTarget = () => null,
    }) => {
      const hardDeadline = performance.now() + 240000;
      let progressDeadline = performance.now() + 30000;
      let signature = warmRecoverySignature(readTarget());
      while (performance.now() < hardDeadline) {
        const shader = g.shaderWarmup;
        const target = readTarget();
        if (!shader || g._webglGeneration !== generation
            || shader.generation !== generation || shader.status === 'invalidated'
            || shader.status === 'skipped'
            || (shader.status === 'degraded' && !shader.recoveryScheduled)) {
          throw new Error(`house failure shader recovery terminal: ${label}: ${JSON.stringify(
            resourceSnapshot(),
          )}`);
        }
        const targetRecoveryScheduled = target?.recoveryScheduled
          ?? shader.recoveryScheduled;
        if (target && (target.generation !== generation
            || ['skipped', 'invalidated'].includes(target.status)
            || (target.status === 'degraded' && !targetRecoveryScheduled))) {
          throw new Error(`house failure target recovery terminal: ${label}: ${JSON.stringify(
            resourceSnapshot(),
          )}`);
        }
        if (isReady()) return;
        const nextSignature = warmRecoverySignature(target);
        if (nextSignature !== signature) {
          signature = nextSignature;
          progressDeadline = performance.now() + 30000;
        } else if (performance.now() >= progressDeadline) {
          throw new Error(`house failure recovery made no progress: ${label}: ${JSON.stringify(
            resourceSnapshot(),
          )}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`house failure recovery exceeded 240s: ${label}: ${JSON.stringify(
        resourceSnapshot(),
      )}`);
    };
    const placeAtMirror = () => {
      F.teleport('house');
      if (g.act !== 'house') throw new Error(`mirror-failure fixture landed in ${g.act}, not house`);
      g.skull.holdNow();
      g.houseMirror.awakened = true;
      g.player.pos.set(g.houseMirror.pos.x + 2.1, 0, g.houseMirror.pos.z);
      g.player.yaw = Math.PI / 2;
      g.player.pitch = 0;
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
    };

    // Initial resident-target bind fails twice. World rendering must stay live;
    // only the unsafe pane is held as dark glass.
    const originalSetRenderTarget = renderer.setRenderTarget;
    const initialHouseTarget = g.houseMirror.pool.pool[0];
    let bindFailures = 0;
    renderer.setRenderTarget = function injectedHouseBindFailure(target, ...args) {
      if (target === initialHouseTarget) {
        bindFailures++;
        throw new Error('injected house mirror target bind failure');
      }
      return originalSetRenderTarget.call(this, target, ...args);
    };
    F.start();
    g._selfStep = false;
    placeAtMirror();
    await waitForWarmRecovery({
      label: 'initial bind degradation',
      generation: g._webglGeneration,
      ready: () => g.shaderWarmup?.status === 'degraded'
        && g.shaderWarmup.recoveryScheduled === true
        && bindFailures === 2
        && g._houseMirrorTargetWarmState?.status === 'degraded'
        && g._houseMirrorTargetWarmState?.targetRef === initialHouseTarget,
    });
    // The recovery timer is already armed for 800ms. Prove one live degraded
    // frame and capture it synchronously so a throttled rAF cannot let the
    // retry replace this state (or exercise the still-injected wrapper) first.
    g.render();
    const bindFailed = resourceSnapshot();
    renderer.setRenderTarget = originalSetRenderTarget;
    // Let destination owner batches continue, but keep the real mirror
    // ineligible until the ready boundary has been captured. Otherwise a fast
    // retry can certify and reveal before the fixture starts observing it.
    g.houseMirror.awakened = false;
    g.houseMirror.active = false;
    g.houseMirror.pane.setActive(false);

    await waitForWarmRecovery({
      label: 'same-generation bind recovery ready',
      generation: bindFailed.generation,
      ready: () => g.shaderWarmup?.status === 'ready'
        && g.shaderWarmup.generation === bindFailed.generation
        && g._houseMirrorTargetWarmState?.status === 'ready',
      target: () => g._houseMirrorTargetWarmState,
    });
    placeAtMirror();
    const bindRecoveryKey = g._currentGpuResidencyKey();
    const bindRecoveryBefore = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
    };
    await waitForWarmRecovery({
      label: 'same-generation bind recovery owner settlement and pane',
      generation: bindFailed.generation,
      ready: () => g.shaderWarmup?.status === 'ready'
        && g.shaderWarmup.generation === bindFailed.generation
        && g._houseMirrorTargetWarmState?.status === 'ready'
        && houseOwnerPaneReady(bindFailed.generation, bindRecoveryKey),
      target: () => g._houseMirrorTargetWarmState,
    });
    const bindRecovered = {
      ...resourceSnapshot(),
      before: bindRecoveryBefore,
      after: {
        programs: renderer.info.programs?.length || 0,
        textures: renderer.info.memory.textures,
      },
    };

    // Now let the pool bind but reject only the target-bound house program.
    // The next clean context generation must recover without reloading gameplay.
    const originalCompile = g._compileWarmVariant;
    let reflectionCompileFailures = 0;
    g._compileWarmVariant = function injectedHouseReflectionFailure(scene, camera) {
      if (renderer.getRenderTarget() === g.houseMirror.pool.pool[0]) {
        reflectionCompileFailures++;
        throw new Error('injected house reflection program failure');
      }
      return originalCompile.call(this, scene, camera);
    };
    await cycleContext();
    const reflectionFailureGeneration = g._webglGeneration;
    await waitForWarmRecovery({
      label: 'reflection degradation',
      generation: reflectionFailureGeneration,
      ready: () => g.shaderWarmup?.status === 'degraded'
        && g.shaderWarmup.recoveryScheduled === true
        && reflectionCompileFailures > 0
        && !(g.shaderWarmup.readyVariants || []).includes('house-reflection'),
      target: () => g._houseMirrorTargetWarmState,
    });
    placeAtMirror();
    g.render();
    const reflectionFailed = resourceSnapshot();
    g._compileWarmVariant = originalCompile;

    await waitForWarmRecovery({
      label: 'same-generation reflection recovery ready',
      generation: reflectionFailureGeneration,
      ready: () => g.shaderWarmup?.status === 'ready'
        && g.shaderWarmup.generation === reflectionFailureGeneration
        && g._houseMirrorTargetWarmState?.status === 'ready',
      target: () => g._houseMirrorTargetWarmState,
    });
    placeAtMirror();
    const reflectionRecoveryBefore = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
    };
    await frame();
    const reflectionRecovered = {
      ...resourceSnapshot(),
      before: reflectionRecoveryBefore,
      after: {
        programs: renderer.info.programs?.length || 0,
        textures: renderer.info.memory.textures,
      },
    };

    // Real runtime fault, not warmup injection: make the first house pane render
    // throw after all resources are certified. Mirrors must contain it, restore
    // the physical world pass, darken glass and self-heal in this same context.
    const originalRendererRender = renderer.render;
    let houseRuntimeFaults = 0;
    renderer.render = function injectedLiveHouseRender(scene, camera) {
      if (renderer.getRenderTarget() === g.houseMirror.pool.pool[0]
          && houseRuntimeFaults === 0) {
        houseRuntimeFaults++;
        throw new Error('injected live house pane render failure');
      }
      return originalRendererRender.call(this, scene, camera);
    };
    let houseRuntimeEscaped = null;
    try { g.render(); } catch (error) { houseRuntimeEscaped = error?.message || `${error}`; }
    renderer.render = originalRendererRender;
    const houseRuntimeFailed = {
      ...resourceSnapshot(),
      escaped: houseRuntimeEscaped,
      poolInUpdate: g.houseMirror.pool._inUpdate,
      scopeVisible: g.houseMirror.pane.mesh.visible,
      failure: g.houseMirror.pool.lastFailure,
    };
    const houseRuntimeGeneration = g._webglGeneration;
    await waitForWarmRecovery({
      label: 'live house pane recovery',
      generation: houseRuntimeGeneration,
      ready: () => g.shaderWarmup?.status === 'ready'
        && g.shaderWarmup.generation === houseRuntimeGeneration
        && g._houseMirrorTargetWarmState?.status === 'ready',
      target: () => g._houseMirrorTargetWarmState,
    });
    placeAtMirror();
    await frame();
    const houseRuntimeRecovered = resourceSnapshot();

    // The same owner callback protects the four-pane Finale. Inject a live FBO
    // bind fault, then require same-generation shader/target recovery.
    // Enter through the legal post-waterfall state. Reattaching the original
    // skull after sacrifice creates an impossible P18 rig and can leave every
    // real pane ineligible, making a zero-count injection meaningless.
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('mirror');
    await waitFor(() => g.finale.active && g.act === 'mirror', 'active Finale setup');
    const finalePhysicalGeneration = g._webglGeneration;
    await waitForWarmRecovery({
      label: 'active Finale physical residency',
      generation: finalePhysicalGeneration,
      ready: () => g.shaderWarmup?.status === 'ready'
        && g.currentGpuResidency?.physical?.has(g._currentGpuResidencyKey())
        && !g.lastRender?.reducedDetail,
      target: () => g.finale._targetWarmState,
    });
    await waitFor(() => g.finale._targetWarmState?.status === 'ready'
      && g.currentGpuResidency?.owners?.has(g._ownerGpuResidencyKey('finale'))
      && g.finale.panes.some((pane) => pane.active),
    'active Finale owner and pane eligibility');
    const finaleTarget0 = g.finale.mirrors.pool[0];
    const originalFinaleSetTarget = renderer.setRenderTarget;
    let finaleRuntimeFaults = 0;
    renderer.setRenderTarget = function injectedLiveFinaleBind(target, ...args) {
      if (target === finaleTarget0 && finaleRuntimeFaults === 0) {
        finaleRuntimeFaults++;
        throw new Error('injected live Finale pane bind failure');
      }
      return originalFinaleSetTarget.call(this, target, ...args);
    };
    let finaleRuntimeEscaped = null;
    try { g.render(); } catch (error) { finaleRuntimeEscaped = error?.message || `${error}`; }
    renderer.setRenderTarget = originalFinaleSetTarget;
    const finaleRuntimeFailed = {
      generation: g._webglGeneration,
      shaderStatus: g.shaderWarmup?.status,
      drawCalls: g.lastRender?.drawCalls || 0,
      worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
      escaped: finaleRuntimeEscaped,
      poolInUpdate: g.finale.mirrors._inUpdate,
      scopesVisible: g.finale.panes.map((pane) => pane.mesh.visible),
      panesActive: g.finale.panes.map((pane) => pane.active),
      contextRewarming: g.finale._contextRewarming,
      failure: g.finale.mirrors.lastFailure,
    };
    const finaleRuntimeGeneration = g._webglGeneration;
    await waitForWarmRecovery({
      label: 'live Finale pane recovery',
      generation: finaleRuntimeGeneration,
      ready: () => g.shaderWarmup?.status === 'ready'
        && g.shaderWarmup.generation === finaleRuntimeGeneration
        && g.finale._targetWarmState?.status === 'ready',
      target: () => g.finale._targetWarmState,
    });
    await frame();
    const finaleRuntimeRecovered = {
      generation: g._webglGeneration,
      shaderStatus: g.shaderWarmup?.status,
      targetStatus: g.finale._targetWarmState?.status,
      contextRewarming: g.finale._contextRewarming,
      panesActive: g.finale.panes.map((pane) => pane.active),
      drawCalls: g.lastRender?.drawCalls || 0,
      worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
    };
    return {
      supported: true,
      bindFailures,
      reflectionCompileFailures,
      bindFailed,
      bindRecovered,
      reflectionFailed,
      reflectionRecovered,
      houseRuntimeFaults,
      houseRuntimeFailed,
      houseRuntimeRecovered,
      finaleRuntimeFaults,
      finaleRuntimeFailed,
      finaleRuntimeRecovered,
    };
  });
  report.browserErrors.push(...opened.errors.map((error) => `house-failure: ${error}`));
  await page.close();
  return value;
}

const server = await ensureServer();
let raceBrowser = null;
let contextBrowser = null;
let failureBrowser = null;
let settledBrowser = null;
try {
  raceBrowser = await launchBrowser();
  report.race = await runImmediateRace(raceBrowser);
  await raceBrowser.close();
  raceBrowser = null;

  contextBrowser = await launchBrowser();
  report.contextRecovery = await runContextRecovery(contextBrowser);
  await contextBrowser.close();
  contextBrowser = null;

  failureBrowser = await launchBrowser();
  report.houseFailures = await runHouseFailureRecovery(failureBrowser);
  await failureBrowser.close();
  failureBrowser = null;

  settledBrowser = await launchBrowser();
  const result = await runPurityAndSettled(settledBrowser);
  report.purity = result.purity;
  report.settled = result.settled;
  report.caveTail = result.caveTail;
  report.renderer = result.renderer;
  check(/(?:D3D11|Direct3D11)/i.test(report.renderer || ''),
    'the broad transition composition gate runs on real ANGLE D3D11', {
      renderer: report.renderer,
    });

  const same = (a, b, key) => JSON.stringify(a[key]) === JSON.stringify(b[key]);
  const { afterStart, afterAudio, afterWarm } = report.purity;
  check(report.purity.startMs < 50,
    'Wake Up returns in under 50ms without waiting on audio or GPU warmup',
    { startMs: round(report.purity.startMs) });
  check(report.purity.audioInitCalls?.length === 1
      && report.purity.audioInitCalls[0].durationMs < 50
      && report.purity.wakeTaskMs < 50,
    'gesture-owned context and silent graph setup reach the first paint inside 50ms', {
      startMs: round(report.purity.startMs),
      wakeTaskMs: round(report.purity.wakeTaskMs),
      audioInitCalls: report.purity.audioInitCalls,
    });
  check(report.purity.audioPreparation?.contextExists
      && ['running', 'suspended', 'interrupted'].includes(report.purity.audioPreparation.contextState)
      && report.purity.audioPreparation.graphInitialized === false
      && report.purity.audioPreparation.masterExists === false
      && report.purity.audioPreparation.startupSourcesStarted === false
      && report.purity.audioPreparation.ready === false
      && report.purity.audioPreparation.status === 'idle'
      && report.purity.audioPreparation.prepareCalls === 1
      && Number.isFinite(report.purity.audioPreparation.contextPrepareStartedAt)
      && Number.isFinite(report.purity.audioPreparation.contextPrepareReadyAt)
      && Number.isFinite(report.purity.audioPreparation.contextCreatedAt)
      && report.purity.audioPreparation.contextPrepareStartedAt
        <= report.purity.audioPreparation.contextCreatedAt
      && report.purity.audioPreparation.contextCreatedAt
        === report.purity.audioPreparation.contextPrepareReadyAt
      && Number.isFinite(report.purity.audioPreparation.contextPrepareMs)
      && report.purity.audioPreparation.contextPrepareMs
        === report.purity.audioPreparation.contextPrepareReadyAt
          - report.purity.audioPreparation.contextPrepareStartedAt
      && report.purity.audioPreparation.contextPrepareMs < 500
      && report.purity.audioPreparation.contextPrepareError == null,
    'native WebAudio context preparation completes during title loading without creating the graph or sources',
    report.purity.audioPreparation);
  const audioStartup = report.purity.audioStartup;
  const audioSlices = audioStartup?.slices || [];
  const audioResources = report.purity.audioResources;
  check(afterStart.audioReady === false && afterAudio?.audioReady === true
      && audioStartup?.status === 'ready'
      && audioStartup.initCalls === 1
      && audioStartup.contextState === 'running'
      && audioStartup.resumeError == null
      && audioStartup.cancelReason == null
      && audioStartup.error == null,
    'Wake preserves its user-gesture AudioContext edge while readiness moves to the deferred bake', {
      afterStart: afterStart.audioReady,
      afterAudio: afterAudio?.audioReady,
      startup: audioStartup,
    });
  check(Number.isFinite(audioStartup?.requestedAt)
      && Number.isFinite(audioStartup?.contextCreatedAt)
      && Number.isFinite(audioStartup?.startedAt)
      && Number.isFinite(audioStartup?.readyAt)
      && audioStartup.contextCreatedAt <= audioStartup.requestedAt
      && audioStartup.contextPrepareStartedAt
        === report.purity.audioPreparation.contextPrepareStartedAt
      && audioStartup.contextPrepareReadyAt
        === report.purity.audioPreparation.contextPrepareReadyAt
      && audioStartup.contextCreatedAt === report.purity.audioPreparation.contextCreatedAt
      && audioStartup.contextPrepareReadyAt <= audioStartup.requestedAt
      && audioStartup.requestedAt <= audioStartup.startedAt
      && audioStartup.startedAt <= audioStartup.readyAt
      && audioStartup.durationMs === audioStartup.readyAt - audioStartup.startedAt
      && audioStartup.totalLatencyMs === audioStartup.readyAt - audioStartup.requestedAt
      && audioStartup.durationMs < 2000 && audioStartup.totalLatencyMs < 2000,
    'the complete procedural soundscape becomes audible within a finite two-second startup envelope',
    audioStartup);
  check(audioStartup?.primitiveLimit === 1
      && audioStartup.pcmChunkSamples === 12000
      && audioStartup.totalPrimitives > 0
      && audioStartup.completed === audioStartup.totalPrimitives
      && audioStartup.pending === 0
      && audioStartup.droppedSlices === 0
      && audioSlices.length === audioStartup.totalPrimitives + 1
      && audioSlices.length <= audioStartup.sliceTelemetryLimit
      && audioSlices[0]?.labels?.[0] === 'plan-core-pcm'
      && audioSlices[0]?.primitiveCount === 0
      && audioSlices[0]?.remaining === audioStartup.totalPrimitives
      && audioSlices.at(-1)?.labels?.[0] === 'activate-core-audio'
      && audioSlices.at(-1)?.remaining === 0
      && audioSlices.every((slice, index) => slice.index === index
        && slice.scheduler === 'paint'
        && slice.durationMs < 16
        && slice.maxPrimitiveMs < 16
        && (index === 0
          ? slice.primitiveCount === 0
          : slice.primitiveCount === 1 && slice.labels.length === 1
            && slice.remaining === audioStartup.totalPrimitives - index))
      && audioStartup.maxSliceMs < 16 && audioStartup.maxPrimitiveMs < 16,
    'audio planning and PCM generation yield after every paint with one strict sub-16ms primitive per slice',
    audioStartup);
  check(audioResources?.startupSourcesStarted === true
      && JSON.stringify(Object.keys(audioResources.impulseBuffers || {}).sort())
        === JSON.stringify(['cave', 'interior', 'outdoor'])
      && audioResources.contextSampleRate >= 16000
      && Object.values(audioResources.impulseBuffers || {}).every((buffer) =>
        buffer?.channels === 2 && buffer.length > 0
          && buffer.sampleRate === audioResources.contextSampleRate)
      && audioResources.noiseSamples > 0 && audioResources.cricketSamples > 0
      && audioResources.woodSteps === 3 && audioResources.stoneSteps === 3
      && audioResources.dirtSteps === 3 && audioResources.leafSteps === 4,
    'deferred activation publishes every core buffer and starts the finite bed sources only after completion',
    audioResources);
  check(report.purity.warmup.status === 'ready' && report.purity.warmup.errors.length === 0,
    'the exact representative compiler reaches ready without degradation', report.purity.warmup);
  check(report.purity.warmup.variants.includes('ossuary'),
    'the settled compiler includes the exact sealed-ossuary light/material variant', {
      variants: report.purity.warmup.variants,
      rootRegistry: report.purity.warmup.rootRegistry,
    });
  const fixedWorldLabels = [
    'core-ordinary', 'house-world', 'house-reflection', 'ossuary', 'ordinary',
    'forest', 'clearing', 'cave-lights', 'cave-threat', 'finale-world',
    'reflection-target',
  ];
  const exactFixedRig = (label) => {
    const types = report.purity.warmup.variantLightTypes?.[label];
    return report.purity.warmup.variantLights?.[label] === 20
      && exactP16LightCensus(types);
  };
  check(fixedWorldLabels.every(exactFixedRig),
    'every world and reflection warm pass uses exact A1/H1/D1/S1/P16 with one directional shadow', {
      variantLights: report.purity.warmup.variantLights,
      variantLightTypes: report.purity.warmup.variantLightTypes,
    });
  const heldTypes = report.purity.warmup.variantLightTypes?.['held-view'];
  check(report.purity.warmup.variantLights?.['held-view'] === 2
      && heldTypes?.total === 2 && heldTypes.PointLight === 2
      && heldTypes.totalShadows === 0,
    'held pass remains an isolated exact two-PointLight program signature', heldTypes);
  check(report.purity.warmup.representatives > 0 && report.purity.warmup.representatives < 420,
    'representative scene stays bounded', { representatives: report.purity.warmup.representatives });
  check(report.purity.warmup.reflectionRepresentatives > 0
      && report.purity.warmup.reflectionRepresentatives < 80,
    'reflection compilation uses a tiny figure-and-skull representative scene', {
      reflectionRepresentatives: report.purity.warmup.reflectionRepresentatives,
    });
  check(report.purity.warmup.maxSetupSliceMs <= 16
      && report.purity.warmup.setupSlices.every((slice) => (slice.nodes || 0) <= 360),
    'district discovery is paint-sliced into bounded 360-node/16ms tasks', {
      maxSetupSliceMs: report.purity.warmup.maxSetupSliceMs,
      setupSlices: report.purity.warmup.setupSlices,
      discoveryNodes: report.purity.warmup.discoveryNodes,
    });
  const paintCompileSlices = report.purity.warmup.compileSlices
    .filter((slice) => slice.scheduledAs !== 'idle');
  const idleCompileSlices = report.purity.warmup.compileSlices
    .filter((slice) => slice.scheduledAs === 'idle');
  check(Math.max(0, ...paintCompileSlices.map((slice) => slice.ms)) <= 16
      && percentile(paintCompileSlices.map((slice) => slice.ms), 0.95) <= 8
      && idleCompileSlices.length > 0
      && idleCompileSlices.every((slice) => slice.ms < 100)
      && report.purity.warmup.variantBatchSize === 1,
    'background shader launches use idle boundaries; paint work stays p95 8ms/hard 16ms and every driver launch stays sub-100ms', {
      maxCompileSliceMs: report.purity.warmup.maxCompileSliceMs,
      paintCompileSlices,
      idleCompileSlices,
      compileSlices: report.purity.warmup.compileSlices,
    });
  check((report.purity.warmup.compileJobs?.length || 0) > 0
      && report.purity.warmup.compileJobsInFlight === 0
      && report.purity.warmup.maxCompileJobsInFlight === 1
      && report.purity.warmup.generationCompileJobsInFlight === 0
      && report.purity.warmup.generationMaxCompileJobsInFlight === 1,
    'the settled shader itinerary submits at most one generation-wide driver compile and drains it completely', {
      jobs: report.purity.warmup.compileJobs?.length || 0,
      statePeak: report.purity.warmup.maxCompileJobsInFlight,
      stateFinal: report.purity.warmup.compileJobsInFlight,
      generationPeak: report.purity.warmup.generationMaxCompileJobsInFlight,
      generationFinal: report.purity.warmup.generationCompileJobsInFlight,
    });
  check((report.purity.warmup.primeRepresentatives ?? 0) === 0
      && (report.purity.warmup.reflectionPrimeRepresentatives ?? 0) === 0
      && (report.purity.warmup.primeSlices || []).length === 0,
    'background warmup contains no universal clone/geometry-prime registry', {
      primeRepresentatives: report.purity.warmup.primeRepresentatives ?? 0,
      reflectionPrimeRepresentatives: report.purity.warmup.reflectionPrimeRepresentatives ?? 0,
      primeSlices: report.purity.warmup.primeSlices || [],
    });
  check(report.purity.residency?.exactPasses?.length > 0
      && report.purity.residency?.reducedPasses?.length > 0
      && report.purity.residency.reducedPasses[0].geometries > 0
      && report.purity.residency.reducedPasses.every((entry) =>
        entry.error == null && entry.objects > 0 && entry.objects <= 32
        && entry.types?.meshes + entry.types?.lines + entry.types?.points === entry.objects
        && entry.geometries >= 0 && entry.geometries <= 16
        && entry.geometryDelta >= 0 && entry.geometryDelta <= 16
        && entry.geometryBytes >= 0 && entry.maxGeometryBytes >= 0
        && entry.maxGeometryBytes <= entry.geometryBytes && entry.vertices >= 0
        && entry.durationMs < 100)
      && report.purity.residency.exactPasses.every((entry) =>
        entry.error == null && entry.programDelta === 0
        && entry.textureDelta === 0 && entry.geometryDelta === 0
        && entry.durationMs < 100)
      && report.purity.residency.exactPreloadPasses?.length > 0
      && report.purity.residency.exactPreloadPasses.every(validExactPreload)
      && report.purity.residency.maxExactMs < 100
      && report.purity.residency.maxExactPreloadMs < 100
      && report.purity.residency.maxReducedPrimeMs < 100
      && report.purity.residency.skullWorldPasses?.length === 1
      && report.purity.residency.skullWorldPasses[0].tether === true
      && report.purity.residency.skullWorldPasses[0].stateRestored === true
      && report.purity.residency.skullWorldPasses[0].programDelta === 0
      && report.purity.residency.skullWorldPasses[0].textureDelta === 0
      && report.purity.residency.skullWorldPasses[0].geometryDelta === 0
      && report.purity.residency.errors.length === 0,
    'current-view uploads, exact program-selection batches, and the actual WORLD/P16 skull+tether certificate all remain bounded and transactional',
    report.purity.residency);
  const houseOwnerUniverse = report.purity.residency?.ownerUniverses
    ?.find((entry) => entry.house > 0);
  const houseOwnerBatches = report.purity.residency?.reducedPasses
    ?.filter((entry) => entry.kind === 'owner-preload-batch') || [];
  const houseOwnerExactBatches = report.purity.residency?.exactPreloadPasses
    ?.filter((entry) => entry.kind === 'owner-exact-preload-batch'
      && entry.targetOwner === 'house') || [];
  const houseOwnerFinalizers = report.purity.residency?.universeFinalizePasses
    ?.filter((entry) => entry.scope === 'owner' && entry.kind === 'house-owner-exact-finalize')
    || [];
  const houseOwnerFinalizerFrames = report.purity.residency?.finalizerFrames
    ?.filter((entry) => entry.kind === 'house-owner-exact-finalize') || [];
  const purityProgress = report.purity.residency?.progress;
  check(houseOwnerUniverse?.house > 0
      && houseOwnerUniverse.total === houseOwnerUniverse.house
      && houseOwnerUniverse.houseGeometries > 0
      && houseOwnerUniverse.covered === houseOwnerUniverse.total
      && JSON.stringify(houseOwnerUniverse.coveredMembers)
        === JSON.stringify(houseOwnerUniverse.members)
      && houseOwnerUniverse.exactTotal === houseOwnerUniverse.exactCovered
      && houseOwnerUniverse.exactTotal >= houseOwnerUniverse.total
      && JSON.stringify(houseOwnerUniverse.exactCoveredMembers)
        === JSON.stringify(houseOwnerUniverse.exactMembers)
      && houseOwnerUniverse.exactOnlyDecorative
        === houseOwnerUniverse.exactOnlyMembers.length
      && houseOwnerBatches.length > 0
      && houseOwnerExactBatches.length > 0
      && houseOwnerExactBatches.every(validExactPreload)
      && houseOwnerExactBatches.every((entry) => entry.key === houseOwnerUniverse.key)
      && houseOwnerExactBatches.every((entry) => entry.targetUuid != null)
      && report.purity.residency.ownerFullFrames === houseOwnerBatches.length
      && houseOwnerBatches.every((entry) => entry.physicalReady === true
        && entry.ownerPreloadObjects > 0
        && entry.ownerPreloadGeometries <= 16
        && entry.geometryDelta <= 16 && entry.durationMs < 100)
      && houseOwnerFinalizers.length > 0
      && houseOwnerFinalizers.every((entry) => entry.key === houseOwnerUniverse.key)
      && finalizersOwnZeroDrawFrames(houseOwnerFinalizers, houseOwnerFinalizerFrames)
      && purityProgress?.ownerQueue === 0 && purityProgress.ownerExactQueue === 0
      && purityProgress.ownerRecorded === true && purityProgress.ownerExactRecorded === true
      && purityProgress.ownerFinalizeBlocked === false,
    'house mirror reduced and exact universes converge through bounded target-specific batches and an isolated successful finalizer', {
      universe: houseOwnerUniverse,
      batches: houseOwnerBatches,
      exactBatches: houseOwnerExactBatches,
      finalizers: houseOwnerFinalizers,
      finalizerFrames: houseOwnerFinalizerFrames,
      progress: purityProgress,
    });
  check(JSON.stringify(report.purity.beforeSkullResidency)
      === JSON.stringify(report.purity.afterSkullResidency),
    'hidden WORLD/P16 skull and tether certification restores every live parent, layer, visibility, culling, and opacity field', {
      before: report.purity.beforeSkullResidency,
      after: report.purity.afterSkullResidency,
    });
  check(report.purity.warmup.maxTextureSliceMs <= 16
      && report.purity.warmup.pendingTextures === 0,
    'actual sampler uploads are paint-sliced and resident before district entry', {
      texturesDiscovered: report.purity.warmup.texturesDiscovered,
      texturesWarmed: report.purity.warmup.texturesWarmed,
      pendingTextures: report.purity.warmup.pendingTextures,
      maxTextureSliceMs: report.purity.warmup.maxTextureSliceMs,
      textureSlices: report.purity.warmup.textureSlices,
    });
  check(report.purity.targetWarm?.status === 'ready'
      && report.purity.targetWarm.warmed === 4
      && report.purity.targetWarm.maxSliceMs < 100,
    'all four resident mirror targets allocate one bounded hidden slice at a time', report.purity.targetWarm);
  const gameplayPurityKeys = [
    'act', 'player', 'flags', 'enemies', 'choir', 'spawnSerial', 'spawnLog',
    'skullStage', 'skullMode', 'skullParent', 'exactHead', 'headChildren',
    'figureVisible', 'finaleActive', 'finalePhase', 'contextRewarming',
    'rendererTarget', 'sceneParents', 'audioLoops', 'forestLoops', 'audioZone',
  ];
  for (const key of gameplayPurityKeys) {
    check(same(afterStart, afterAudio, key), `deferred audio startup preserves live ${key}`,
      same(afterStart, afterAudio, key) ? null : {
        before: afterStart[key], after: afterAudio[key],
      });
  }
  for (const key of [
    ...gameplayPurityKeys, 'audioReady',
  ]) {
    check(same(afterAudio, afterWarm, key), `warmup preserves live ${key}`,
      same(afterAudio, afterWarm, key) ? null : { before: afterAudio[key], after: afterWarm[key] });
  }
  const warmIntervals = report.purity.intervals || [];
  check(report.purity.timing?.renderCount > 1
      && report.purity.timing.rafIntervals > 0
      && report.purity.timing.orderingErrors.length === 0
      && Math.max(0, ...warmIntervals) < 100
      && report.purity.timing.maxRenderMs < 100
      && report.purity.timing.maxInterRenderIdleMs < 100
      && report.purity.timing.maxRenderCompletionIntervalMs < 100,
    'immediate-Wake sampling keeps render, inter-render idle, completion, and observed cadence below 100ms', {
      timing: report.purity.timing,
      maxRafMs: round(Math.max(0, ...warmIntervals)),
      p95RafMs: round(percentile(warmIntervals, 0.95)),
    });

  for (const seam of report.settled) {
    const types = seam.after.lightTypes;
    check(seam.after.worldLights === 20
        && types?.AmbientLight === 1 && types?.HemisphereLight === 1
        && types?.DirectionalLight === 1 && types?.SpotLight === 1
        && types?.PointLight === 16 && types?.directionalShadows === 1
        && types?.totalShadows === 1
        && seam.after.ballastViolations.length === 0,
      `${seam.name} live pass uses exact fixed light/shadow signature with inert ballast`, seam.after);
    check(seam.maxVisibleProgramDelta === 0
        && seam.maxVisibleTextureDelta === 0
        && seam.maxVisibleGeometryDelta === 0,
      `${seam.name} first revealed frames compile/upload zero programs, textures, or geometry`, seam);
    check(seam.orderingErrors?.length === 0 && seam.maxRafMs < 100,
      `${seam.name} observed post-render callback cadence stays strictly inside the D3D11 acceptance budget`, seam);
    check(seam.renderCount > 1 && seam.maxRenderMs < 100
        && seam.maxInterRenderIdleMs < 100
        && seam.maxRenderCompletionIntervalMs < 100
        && seam.transitionMs < 100 && seam.cleanupMs < 100,
      `${seam.name} render duration, inter-render idle, and paint-ready completion cadence stay strictly sub-100ms`, seam);
    check(seam.maxStepMs < 20,
      `${seam.name} fixed simulation remains below 20ms`, seam);
    check(seam.worldSubmitted === true && seam.firstWorldMs != null
        && seam.firstWorldMs < 100 && seam.shieldFrames === 0,
      `${seam.name} settled entry submits a nonzero world within 100ms with no opaque frame`, seam);
    check(seam.sweepFrames?.length === 4
        && seam.sweepFrames.every((frame, turn) => {
          const owned = frame?.lookTurn === turn && frame.lookAppliedAt <= frame.startedAt
            && frame.generation === seam.expectedGeneration
            && frame.residencyKey === seam.expectedKey;
          const visiblePhase = frame?.worldDrawCalls > 0
            && (frame.lookPhase === 'exact-visible'
              || (frame.lookPhase === 'reduced-reveal'
                && frame.reducedBatchRevealed === true));
          const hiddenPhase = frame?.worldDrawCalls === 0 && frame.drawCalls === 0
            && frame.lookPhase === 'hidden-residency'
            && (frame.snapshotProgress || frame.reducedBatchSubmitted
              || frame.reducedBatchRevealed || frame.ownerProgress
              || frame.deferredProgress || frame.ownerExactProgress
              || frame.deferredExactProgress || frame.reducedPassesAdded > 0
              || frame.exactPassesAdded > 0 || frame.exactPreloadPassesAdded > 0
              || frame.ownerPassesAdded > 0 || frame.finalizerPassesAdded > 0);
          return owned && !frame.shielded && (visiblePhase || hiddenPhase)
            && frame.visibleProgramDelta === 0 && frame.visibleTextureDelta === 0
            && frame.ms < 100;
        })
        && seam.sweepMaxRafMs < 100,
      `${seam.name} four-way look rows stay key-owned and sub-100ms across visible and isolated residency phases`, {
        frames: seam.sweepFrames,
        maxRafMs: seam.sweepMaxRafMs,
      });
  }

  const caveTail = report.caveTail;
  check(caveTail.samples === 2400
      && caveTail.maxStepMs < 20
      && caveTail.p99StepMs < 4,
    'twenty simulated cave seconds keep the 120 Hz fixed step below GC-tail budgets', caveTail);
  check(caveTail.metricsAfter.staticWrites === caveTail.metricsBefore.staticWrites
      && caveTail.metricsAfter.atmosphereWrites === caveTail.metricsBefore.atmosphereWrites
      && caveTail.metricsAfter.steadyWrites === caveTail.metricsBefore.steadyWrites
      && caveTail.metricsAfter.steadyTicks - caveTail.metricsBefore.steadyTicks
        === caveTail.samples,
    'steady Underfalls ticks perform zero scene/atmosphere visibility rewrites', caveTail);
  check(caveTail.ballastMetricsAfter.registryRefreshes
        === caveTail.ballastMetricsBefore.registryRefreshes
      && caveTail.ballastMetricsAfter.registrySize < 80,
    'fixed P16 reconciliation scans only its cached light registry during steady cave renders',
    { before: caveTail.ballastMetricsBefore, after: caveTail.ballastMetricsAfter });
  check(caveTail.visibleWorldLightCount === caveTail.allowedWorldLightCount
      && caveTail.visibleWorldLightCount === 20
      && caveTail.unexpectedLights.length === 0
      && caveTail.missingLights.length === 0,
    'Underfalls exposes only its authored cave rig plus fixed zero-energy slots', caveTail);
  check(caveTail.lightTypes?.AmbientLight === 1
      && caveTail.lightTypes?.HemisphereLight === 1
      && caveTail.lightTypes?.DirectionalLight === 1
      && caveTail.lightTypes?.SpotLight === 1
      && caveTail.lightTypes?.PointLight === 16
      && caveTail.lightTypes?.directionalShadows === 1
      && caveTail.lightTypes?.totalShadows === 1,
    'live Underfalls matches the fixed A1/H1/D1/S1/P16 shadow signature', caveTail.lightTypes);
  check(caveTail.caveShellRoots.length === 1
      && caveTail.caveShellRoots[0].visible === true
      && caveTail.caveShellRoots[0].vertices > 0
      && caveTail.exteriorRockRoots.length > 0
      && caveTail.exteriorRockRoots.every((root) => root.visible === false),
    'Underfalls owns exactly its visible structural shell while every exterior rock root is culled',
    caveTail);
  check(caveTail.programsAfter === caveTail.programsBefore
      && caveTail.texturesAfter === caveTail.texturesBefore,
    'long Underfalls residency keeps program and texture counts stable', caveTail);
  check(caveTail.heapPeakGrowth == null || caveTail.heapPeakGrowth < 24 * 1024 * 1024,
    'long Underfalls residency has no unbounded allocation tail', caveTail);

  // Race evidence is kept diagnostic: it attacks a timing faster than human
  // traversal, but a visible render must still never be the place a program or
  // four-target allocation is first created.
  check(report.race.startMs < 50,
    'adversarial immediate Wake Up remains responsive', report.race);
  check(report.race.wakeHouse?.wakeToFirstWorldMs != null
      && report.race.wakeHouse.wakeToFirstWorldMs <= 150
      && report.race.wakeHouse.shieldFrames === 0
      && report.race.wakeHouse.maxShieldDurationMs === 0,
    'Wake reveals a moving physical house silhouette within 150ms and never waits on background shaders',
    report.race.wakeHouse);
  const wakeRows = report.race.firstImpact?.renderRows || [];
  const combinedWakeRows = wakeRows.filter((row) => row.snapshotProgress
    && row.reducedBatchSubmitted && !row.reducedBatchRevealed
    && row.drawCalls === 0 && row.worldDrawCalls === 0);
  const combinedWakeIndex = combinedWakeRows.length === 1
    ? wakeRows.indexOf(combinedWakeRows[0]) : -1;
  const combinedWake = combinedWakeIndex >= 0 ? wakeRows[combinedWakeIndex] : null;
  const wakeReveal = combinedWakeIndex >= 0 ? wakeRows[combinedWakeIndex + 1] : null;
  check(combinedWakeRows.length === 1 && combinedWake != null && wakeReveal != null
      && wakeReveal.frameId === combinedWake.frameId + 1
      && wakeReveal.generation === combinedWake.generation
      && wakeReveal.residencyKey != null
      && wakeReveal.residencyKey === combinedWake.residencyKey
      && combinedWake.reducedDetail === true
      && wakeReveal.reducedBatchRevealed === true
      && wakeReveal.snapshotProgress === false
      && wakeReveal.reducedBatchSubmitted === false
      && wakeReveal.reducedDetail === true
      && wakeReveal.worldDrawCalls > 0
      && combinedWake.ms < 100 && wakeReveal.ms < 100,
    'Wake combines current census with one hidden reduced upload, then reveals it on the immediately following bounded paint',
    { combinedWake, wakeReveal, wakeRows });
  const wakeTypes = report.race.wakeHouse?.lightTypes;
  check(report.race.wakeHouse?.worldLights === 20
      && wakeTypes?.AmbientLight === 1 && wakeTypes?.HemisphereLight === 1
      && wakeTypes?.DirectionalLight === 1 && wakeTypes?.SpotLight === 1
      && wakeTypes?.PointLight === 16 && wakeTypes?.directionalShadows === 1
      && wakeTypes?.totalShadows === 1,
    'first interactive house pass already owns the fixed A1/H1/D1/S1/P16 shadow signature',
    report.race.wakeHouse);
  const boot = report.race.bootTiming || {};
  check(boot.titleInteractiveAt - boot.moduleStartedAt < 100
      && boot.titlePaintOpportunityAt - boot.moduleStartedAt < 1000
      && boot.constructedAt - boot.constructorStartedAt < 1800,
    'title action is wired before the bounded world constructor and receives a paint first', boot);
  check(report.race.paint?.['first-contentful-paint'] != null
      && report.race.paint['first-contentful-paint'] < 1000,
    'key art/title reaches first contentful paint within one second of navigation', report.race.paint);
  check(boot.firstRenderEndedAt - boot.firstRenderStartedAt < 20,
    'first title frame remains a GPU-empty DOM presentation under 20ms', {
      boot,
      paint: report.race.paint,
    });
  check(JSON.stringify(report.race.moonShadow?.mapSize) === '[1024,1024]'
      && report.race.moonShadow.mapUuid === null
      && report.race.moonShadow.pending === false
      && report.race.moonShadow.armed === false
      && report.race.moonShadow.inFlight === false,
    'immediate Wake permanently retires an unprimed moon shadow before the idle timeout can hit play',
    report.race.moonShadow);
  check(report.race.flamePool?.initialized === true
      && report.race.flamePool.embers === 2
      && report.race.flamePool.sparks === 7,
    'cold boot constructs the complete carried-flame pool before interaction',
    report.race.flamePool);
  check(report.race.warmupBeforeStart === 'scheduled',
    'adversarial Wake Up occurs before any warmup setup begins', {
      warmupBeforeStart: report.race.warmupBeforeStart,
    });
  check(JSON.stringify(report.race.earlyHousePriority?.keys) === '["house","house","house"]'
      && report.race.earlyHousePriority.restarts === 0,
    'bedroom, house, and basement share one warm priority without restart thrash',
    report.race.earlyHousePriority);
  check(report.race.rafIntervals > 0 && report.race.orderingErrors.length === 0
      && report.race.maxRafMs < 100,
    'the complete immediate-Wake/fast-entry race keeps observed callback cadence strictly sub-100ms', {
      maxRafMs: report.race.maxRafMs,
      p95RafMs: report.race.p95RafMs,
      maxRenderMs: report.race.maxRenderMs,
    });
  check(report.race.renderCount > 1 && report.race.maxRenderMs < 100
      && report.race.maxInterRenderIdleMs < 100
      && report.race.maxRenderCompletionIntervalMs < 100,
    'the complete immediate-Wake/fast-entry race keeps render, inter-render idle, and paint-ready cadence strictly sub-100ms', {
      maxRenderMs: report.race.maxRenderMs,
      maxRenderStartIntervalMs: report.race.maxRenderStartIntervalMs,
      maxInterRenderIdleMs: report.race.maxInterRenderIdleMs,
      maxRenderCompletionIntervalMs: report.race.maxRenderCompletionIntervalMs,
    });
  check(report.race.residency?.maxReducedPrimeMs < 100
      && report.race.residency?.maxExactMs < 100
      && report.race.residency?.maxExactPreloadMs < 100
      && report.race.residency?.maxOwnerMs < 100
      && report.race.residency?.exactPreloadPasses?.every(validExactPreload)
      && finalizerAttemptsOwnZeroDrawFrames(
        report.race.residency?.universeFinalizePasses || [],
        report.race.residency?.finalizerFrames || [],
      )
      && report.race.residency?.errors?.length === 0,
    'exact selection, live-scene, reduced fallback, finalization, and owner-RT work remain inside strict hard budgets',
    report.race.residency);
  check(report.race.maxShieldDurationMs === 0
      && report.race.transitions.every((seam) => seam.shieldFrames === 0),
    'the full impossible-fast race never uses an opaque shader shield', {
      maxShieldDurationMs: report.race.maxShieldDurationMs,
      transitions: report.race.transitions,
    });
  check(report.race.firstImpact.before.pointLights === report.race.firstImpact.after.pointLights
      && report.race.firstImpact.before.sceneChildren === report.race.firstImpact.after.sceneChildren
      && report.race.firstImpact.before.lightUuid === report.race.firstImpact.after.lightUuid
      && report.race.firstImpact.before.ringUuid === report.race.firstImpact.after.ringUuid
      && report.race.firstImpact.activation?.ringVisible === true
      && report.race.firstImpact.activation?.bootPrime === false
      && report.race.firstImpact.activation?.ringT > 0
      && report.race.firstImpact.activation?.ringIn === true
      && report.race.firstImpact.activation?.lightIntensity > 0
      && report.race.firstImpact.activation?.hitStop > 0,
    'first locked/bell impact reuses its boot-resident light and ring without scene allocation',
    report.race.firstImpact);
  check(report.race.firstImpact.visibleRenderProgramDelta === 0
      && report.race.firstImpact.visibleRenderTextureDelta === 0
      && report.race.firstImpact.visibleRenderGeometryDelta === 0,
    'first locked/bell impact compiles and allocates zero visible-frame resources',
    report.race.firstImpact);
  check(report.race.firstImpact.renderCount > 1
      && report.race.firstImpact.maxRafMs < 100
      && report.race.firstImpact.maxRenderMs < 70
      && report.race.firstImpact.maxInterRenderIdleMs < 100
      && report.race.firstImpact.maxRenderCompletionIntervalMs < 100,
    'first locked/bell impact remains inside the ordinary-frame D3D11 budget',
    report.race.firstImpact);

  const recovery = report.contextRecovery;
  check(recovery?.supported === true,
    'WEBGL_lose_context is available for adversarial recovery coverage', recovery);
  if (recovery?.supported) {
    const byLabel = Object.fromEntries(recovery.stages.map((stage) => [stage.label, stage]));
    const outboundProbe = recovery.restoreProbes?.find((probe) => probe.label === 'outbound-skull');
    const outboundResidency = recovery.outboundResidency;
    check(JSON.stringify(recovery.outboundAfter) === JSON.stringify(recovery.outboundBefore)
        && recovery.outboundBefore?.mode === 'outbound'
        && outboundResidency?.errors?.length === 0
        && outboundResidency?.reducedPasses?.length > 0
        && outboundResidency.reducedPasses.every((entry) =>
          entry.geometryDelta >= 0 && entry.geometryDelta <= 16 && entry.durationMs < 100)
        && outboundResidency?.exactPasses?.length > 0
        && outboundResidency.exactPasses.every((entry) => entry.programDelta === 0
          && entry.textureDelta === 0 && entry.geometryDelta === 0 && entry.durationMs < 100)
        && outboundResidency?.exactPreloadPasses?.length > 0
        && outboundResidency.exactPreloadPasses.every(validExactPreload)
        && outboundResidency?.skullWorldPasses?.length === 1
        && outboundResidency.skullWorldPasses[0].stateRestored === true
        && outboundResidency.skullWorldPasses[0].programDelta === 0
        && outboundResidency.skullWorldPasses[0].textureDelta === 0
        && outboundResidency.skullWorldPasses[0].geometryDelta === 0
        && outboundProbe?.firstFull?.programDelta === 0
        && outboundProbe?.firstFull?.textureDelta === 0
        && outboundProbe?.firstFull?.geometryDelta === 0,
      'outbound skull context restore preserves flight/story state and batches every future stage before a zero-delta full reveal', {
        before: recovery.outboundBefore,
        after: recovery.outboundAfter,
        residency: outboundResidency,
        probe: outboundProbe,
      });
    check(byLabel['initial-scheduled']?.shader.status === 'scheduled'
        && byLabel['lost-before-warmup']?.shader.status === 'invalidated',
      'context loss invalidates a not-yet-started warmup token', recovery.stages);
    check(byLabel['pending-before-loss']?.shader.status === 'pending'
        && byLabel['lost-during-warmup']?.shader.status === 'invalidated'
        && byLabel['lost-during-warmup']?.targets === null,
      'context loss invalidates pending shaders and resident-target slices together', recovery.stages);
    for (const label of [
      'ready-after-pending-loss',
      'ready-after-outbound-skull-loss',
      'ready-after-live-choir-loss',
      'ready-after-active-finale-loss',
    ]) {
      const stage = byLabel[label];
      check(stage?.shader.status === 'ready'
          && stage.shader.generation === stage.generation
          && stage.targets?.status === 'ready'
          && stage.targets.generation === stage.generation
          && stage.targets.warmed === 4,
      `${label} certifies only resources from the live GL generation`, stage);
    }
    check(byLabel['ready-after-live-choir-loss']?.shader.choirLights > 0,
      'live Choir restore classifies its owned lights into cave-threat only',
      byLabel['ready-after-live-choir-loss']);
    check(byLabel['lost-with-active-finale']?.finale.rewarming === true
        && byLabel['lost-with-active-finale']?.finale.rewarmGeneration
          === byLabel['lost-with-active-finale']?.generation,
      'active Finale loss immediately shields invalid reflections as dark glass',
      byLabel['lost-with-active-finale']);
    check(byLabel['ready-after-active-finale-loss']?.shader.reflectionUsesMountedHeadLight === true,
      'active-Finale restore reuses the mounted exact-head light without a duplicate fallback',
      byLabel['ready-after-active-finale-loss']);
    const restoreProbeByLabel = Object.fromEntries(
      (recovery.restoreProbes || []).map((probe) => [probe.label, probe]),
    );
    for (const label of ['house', 'cave', 'active-finale']) {
      const probe = restoreProbeByLabel[label];
      check(probe?.worldSubmitted === true
          && probe.firstWorldMs != null && probe.firstWorldMs <= 250
          && probe.shieldDurationMs === 0 && probe.shieldFrames === 0,
        `${label} context restore returns a playable physical world within 250ms without a shader shield`,
        probe);
      check(probe?.frameCount > 1 && probe?.orderingErrors?.length === 0
          && probe?.maxRenderMs < 100
          && probe.maxInterRenderIdleMs < 100
          && probe.maxRenderCompletionIntervalMs < 100
          && probe?.exactPass?.durationMs < 100,
        `${label} restore-to-reveal path contains no driver-sized frame stall`, probe);
      check(probe?.maxVisibleProgramDelta === 0
          && probe?.maxVisibleTextureDelta === 0
          && probe?.maxVisibleGeometryDelta === 0,
        `${label} first revealed world uploads no program, texture, or geometry`, probe);
      check(probe?.reducedFrames > 0
          && probe?.reducedRetainedImpactPrime === true
          && probe?.firstFull?.impactPrime === false
          && probe?.firstFull?.impactVisible === false,
        `${label} retains dormant impact resources through reduced frames and retires them only after exact submission`,
        probe);
      check(probe?.reducedFrames > 0
          && probe?.reducedRetainedFlamePrime === true
          && probe?.afterFullSubmission?.pending === false
          && probe?.afterFullSubmission?.emberVisible === false
          && probe?.afterFullSubmission?.sparkVisible === false,
        `${label} flame resources survive reduced material passes and retire only after full world plus HELD`,
        probe);
    }
    for (const [label, snapshot] of [
      ['pending-loss recovery', recovery.afterPendingRecovery],
      ['live-Choir recovery', recovery.afterReadyRecovery],
      ['active-Finale recovery', recovery.afterActiveFinaleRecovery],
    ]) {
      const expected = label === 'pending-loss recovery'
        ? recovery.afterStart
        : label === 'live-Choir recovery'
          ? recovery.liveChoirBefore
          : recovery.activeFinaleBefore;
      const comparableSnapshot = { ...snapshot };
      const comparableExpected = { ...expected };
      // The reflection-motion probe deliberately moves the player after the
      // restore. Pose is covered by that probe; state-purity here compares the
      // story/audio/skull/finale/parentage fields which must remain invariant.
      if (label === 'active-Finale recovery') {
        delete comparableSnapshot.player;
        delete comparableExpected.player;
      }
      check(JSON.stringify(comparableSnapshot) === JSON.stringify(comparableExpected),
        `${label} preserves gameplay, audio, skull, finale and scene parentage`, {
          before: expected,
          after: snapshot,
        });
    }
    for (const seam of recovery.seams) {
      const types = seam.lightTypes;
      check(seam.worldLights === 20
          && types?.AmbientLight === 1 && types?.HemisphereLight === 1
          && types?.DirectionalLight === 1 && types?.SpotLight === 1
          && types?.PointLight === 16 && types?.directionalShadows === 1
          && types?.totalShadows === 1 && seam.ballastViolations.length === 0,
        `restored-context ${seam.act} keeps the exact live fixed light/shadow rig`, seam);
      check(seam.maxVisibleProgramDelta === 0
          && seam.maxVisibleTextureDelta === 0
          && seam.maxVisibleGeometryDelta === 0,
        `restored-context ${seam.act} first revealed frames upload no programs, textures, or geometry`, seam);
      check(seam.maxRafMs < 100,
        `restored-context ${seam.act} observed callback cadence stays strictly inside the cold-frame budget`, seam);
      check(seam.renderCount > 1 && seam.observedIntervals > 0
          && seam.orderingErrors.length === 0 && seam.maxRenderMs < 100
          && seam.maxInterRenderIdleMs < 100
          && seam.maxRenderCompletionIntervalMs < 100
          && seam.setupMs < 100 && seam.cleanupMs < 100
          && seam.worldSubmitted === true && seam.shielded === false,
        `restored-context ${seam.act} delivers a nonzero world instead of an opaque pass`, seam);
    }
    const recoveredHouseFrame = recovery.firstRecoveredHouseFrame;
    const recoveredHouseFull = recovery.firstRecoveredHouseFullFrame;
    const recoveredHouseTypes = recoveredHouseFull?.lightTypes;
    check(recoveredHouseFrame?.worldDrawCalls > 0
        && recoveredHouseFrame?.visibleProgramDelta === 0
        && recoveredHouseFrame?.visibleTextureDelta === 0
        && recoveredHouseFrame?.visibleGeometryDelta === 0
        && recoveredHouseFrame?.ms < 100,
      'first restored house frame is a bounded nonzero playable submission with zero visible upload',
      recoveredHouseFrame);
    check(recoveredHouseFull?.worldDrawCalls > 0
        && recoveredHouseFull?.heldDrawCalls > 0
        && recoveredHouseFull?.reducedDetail === false
        && recoveredHouseFull?.visibleProgramDelta === 0
        && recoveredHouseFull?.visibleTextureDelta === 0
        && recoveredHouseFull?.visibleGeometryDelta === 0
        && recoveredHouseFull?.ms < 100,
      'first exact restored house world+held frame consumes only hidden-certified resources',
      recoveredHouseFull);
    check(recoveredHouseFull?.worldLights === 20
        && recoveredHouseTypes?.AmbientLight === 1
        && recoveredHouseTypes?.HemisphereLight === 1
        && recoveredHouseTypes?.DirectionalLight === 1
        && recoveredHouseTypes?.SpotLight === 1
        && recoveredHouseTypes?.PointLight === 16
        && recoveredHouseTypes?.directionalShadows === 1
        && recoveredHouseTypes?.totalShadows === 1,
      'first restored house frame matches the fixed directional-shadow signature',
      recoveredHouseFull);
    const restoredHouseSettlement = recovery.restoredHouseSettlement;
    check(recovery.restoredHouseGeneration === byLabel['ready-after-pending-loss']?.generation
        && restoredHouseSettlement?.generation === recovery.restoredHouseGeneration
        && restoredHouseSettlement?.activeKey === recovery.restoredHouseKey
        && restoredHouseSettlement?.progressKey === recovery.restoredHouseKey
        && restoredHouseSettlement?.physical === true
        && restoredHouseSettlement?.ownerQueue === 0
        && restoredHouseSettlement?.ownerExactQueue === 0
        && restoredHouseSettlement?.ownerRecorded === true
        && restoredHouseSettlement?.ownerExactRecorded === true
        && restoredHouseSettlement?.universe?.key === recovery.restoredHouseKey
        && restoredHouseSettlement?.finalizers?.some((entry) =>
          entry.recorded === true && entry.error == null && entry.durationMs < 100)
        && restoredHouseSettlement?.target?.generation === recovery.restoredHouseGeneration
        && restoredHouseSettlement?.target?.status === 'ready'
        && restoredHouseSettlement?.target?.current === true
        && restoredHouseSettlement?.ownerCertified === false
        && restoredHouseSettlement?.mirrorActive === false
        && restoredHouseSettlement?.paneActive === false,
      'restored House destination earns same-generation physical and owner-exact proof while every pane stays dark',
      restoredHouseSettlement);
    for (const view of recovery.restoredHouseViews || []) {
      check(view.maxVisibleProgramDelta === 0
          && view.maxVisibleTextureDelta === 0
          && view.maxVisibleGeometryDelta === 0
          && view.renderCount > 1 && view.observedIntervals > 0
          && view.orderingErrors.length === 0
          && view.setupMs < 100
          && view.maxRafMs < 100 && view.maxRenderMs < 100
          && view.maxInterRenderIdleMs < 100
          && view.maxRenderCompletionIntervalMs < 100,
        `restored house ${view.kind} reveals no cold program/texture/geometry upload`, view);
      if (view.kind.includes('mirror')) {
        check(exactP16LightCensus(view.reflectionLightCensus),
          `restored house ${view.kind} actual reflection camera uses exact A1/H1/D1/S1/P16`,
          view.reflectionLightCensus);
      }
      if (view.kind === 'mirror') {
        check(view.mirrorActive === true && view.paneActive === true
            && view.targetState?.status === 'ready'
            && view.targetState.current === true
            && view.targetState.generation === recovery.restoredHouseGeneration,
          'restored awakened house mirror consumes only its current resident target', view);
        check(view.ownerPasses.length === 1
            && view.ownerPasses[0].rendered === true
            && view.ownerPasses[0].error == null
            && view.ownerPasses[0].durationMs < 100
            && view.ownerPasses[0].programDelta === 0
            && view.ownerPasses[0].textureDelta === 0
            && view.ownerPasses[0].geometryDelta === 0
            && view.firstOwnerPassFrame?.ownerPassesAdded?.length === 1
            && view.firstOwnerPassFrame.ownerPassesAdded[0].kind === 'house'
            && view.firstOwnerPassFrame.frameId < view.firstEnabledFrame?.frameId
            && view.firstEnabledFrame?.programDelta === 0
            && view.firstEnabledFrame?.textureDelta === 0
            && view.firstEnabledFrame?.geometryDelta === 0,
          'house pane certifies its actual owner RT in one bounded hidden pass before first enable', view);
      } else if (view.kind === 'mirror-motion') {
        check(view.ownerPasses.length === 0
            && view.mirrorActive === true && view.paneActive === true
            && view.targetState?.current === true
            && view.firstEnabledFrame?.programDelta === 0
            && view.firstEnabledFrame?.textureDelta === 0
            && view.firstEnabledFrame?.geometryDelta === 0,
          'later restored house mirror motion consumes the completed owner universe without recertification',
          view);
      }
    }
    const restoredHouseUniverse = recovery.restoredHouseOwnerUniverses
      ?.find((entry) => entry.key === recovery.restoredHouseKey && entry.house > 0);
    const restoredHouseFinalizerFrames = matchingFinalizerFrames(
      recovery.restoredHouseFinalizers, recovery.finalizerFrames,
    );
    const restoredHouseTerminalFrame = restoredHouseFinalizerFrames.at(-1) || null;
    const restoredHousePaneFrame = recovery.restoredHouseViews
      ?.find((view) => view.kind === 'mirror')?.firstEnabledFrame || null;
    const restoredHouseOwnerFrame = recovery.restoredHouseViews
      ?.find((view) => view.kind === 'mirror')?.firstOwnerPassFrame || null;
    check(restoredHouseUniverse?.covered === restoredHouseUniverse?.total
        && restoredHouseUniverse?.total === restoredHouseUniverse?.house
        && restoredHouseUniverse?.houseGeometries > 0
        && JSON.stringify(restoredHouseUniverse?.coveredMembers)
          === JSON.stringify(restoredHouseUniverse?.members)
        && restoredHouseUniverse.exactCovered === restoredHouseUniverse.exactTotal
        && restoredHouseUniverse.exactTotal >= restoredHouseUniverse.total
        && JSON.stringify(restoredHouseUniverse.exactCoveredMembers)
          === JSON.stringify(restoredHouseUniverse.exactMembers)
        && restoredHouseUniverse.exactOnlyDecorative
          === restoredHouseUniverse.exactOnlyMembers.length
        && (recovery.restoredHouseOwnerBatches || []).length > 0
        && recovery.restoredHouseOwnerBatches.every((entry) =>
          entry.generation === recovery.restoredHouseGeneration
          && entry.key === recovery.restoredHouseKey
          && entry.physicalReady === true && entry.ownerPreloadObjects > 0
          && entry.ownerPreloadGeometries <= 16 && entry.geometryDelta <= 16
          && entry.durationMs < 100)
        && recovery.restoredHouseOwnerExactBatches?.length > 0
        && recovery.restoredHouseOwnerExactBatches.every(validExactPreload)
        && recovery.restoredHouseOwnerExactBatches.every((entry) =>
          entry.generation === recovery.restoredHouseGeneration
            && entry.key === restoredHouseUniverse.key)
        && recovery.restoredHouseOwnerExactBatches.every((entry) => entry.targetUuid != null)
        && recovery.restoredHouseFinalizers?.length > 0
        && recovery.restoredHouseFinalizers.every((entry) =>
          entry.generation === recovery.restoredHouseGeneration
            && entry.key === restoredHouseUniverse.key)
        && finalizersOwnZeroDrawFrames(
          recovery.restoredHouseFinalizers, restoredHouseFinalizerFrames,
        )
        && restoredHouseTerminalFrame?.frameId < restoredHouseOwnerFrame?.frameId
        && restoredHouseOwnerFrame?.frameId < restoredHousePaneFrame?.frameId,
      'restored house owner scope converges across reduced/exact target batches and bounded finalization', {
        universe: restoredHouseUniverse,
        batches: recovery.restoredHouseOwnerBatches,
        exactBatches: recovery.restoredHouseOwnerExactBatches,
        finalizers: recovery.restoredHouseFinalizers,
        finalizerFrames: restoredHouseFinalizerFrames,
        firstOwnerFrame: restoredHouseOwnerFrame,
        firstPaneFrame: restoredHousePaneFrame,
      });
    check(recovery.restoredImpact?.after.programs
          === recovery.restoredImpact?.before.programs
        && recovery.restoredImpact?.after.textures
          === recovery.restoredImpact?.before.textures
        && recovery.restoredImpact?.after.geometries
          === recovery.restoredImpact?.before.geometries
        && recovery.restoredImpact?.after.lightUuid
          === recovery.restoredImpact?.before.lightUuid
        && recovery.restoredImpact?.after.ringUuid
          === recovery.restoredImpact?.before.ringUuid
        && recovery.restoredImpact?.bootPrime === false
        && recovery.restoredImpact?.activation?.ringVisible === true
        && recovery.restoredImpact?.activation?.bootPrime === false
        && recovery.restoredImpact?.activation?.ringT > 0
        && recovery.restoredImpact?.activation?.ringIn === true
        && recovery.restoredImpact?.activation?.lightIntensity > 0
        && recovery.restoredImpact?.activation?.hitStop > 0
        && recovery.restoredImpact?.setupMs < 100
        && recovery.restoredImpact?.timing?.frames?.length > 1
        && recovery.restoredImpact.timing.observedIntervals > 0
        && recovery.restoredImpact.timing.orderingErrors.length === 0
        && recovery.restoredImpact?.maxRafMs < 100
        && recovery.restoredImpact.timing.maxRenderMs < 100
        && recovery.restoredImpact.timing.maxInterRenderIdleMs < 100
        && recovery.restoredImpact.timing.maxRenderCompletionIntervalMs < 100,
      'first post-restore impact reuses its physically delivered ring/light with zero resource delta',
      recovery.restoredImpact);
    const pools = recovery.dynamicPoolActivation;
    check(pools?.before.goreCount === 0 && pools?.before.stainCount === 0
        && pools?.after.goreCount === 1 && pools?.after.stainCount === 1
        && pools.timing?.frames?.length > 1 && pools.timing.observedIntervals > 0
        && pools.timing.orderingErrors.length === 0
        && pools.setupMs < 100
        && pools.maxRafMs < 100 && pools.timing.maxRenderMs < 100
        && pools.timing.maxInterRenderIdleMs < 100
        && pools.timing.maxRenderCompletionIntervalMs < 100,
      'later offscreen gore and enemy-stain pool activation remains below the ordinary-frame budget',
      pools);
    const firstReflection = recovery.firstRestoredReflection;
    check(firstReflection?.afterPrograms === firstReflection?.beforePrograms
        && firstReflection?.afterTextures === firstReflection?.beforeTextures
        && firstReflection?.afterGeometries === firstReflection?.beforeGeometries,
      'first active-Finale reflection after restore compiles and allocates zero resources',
      firstReflection);
    check(firstReflection?.ms < 100 && recovery.activeRestoreMaxRafMs < 100,
      'active-Finale restore and first reflection remain strictly below 100ms', {
        firstReflection,
        activeRestoreMaxRafMs: recovery.activeRestoreMaxRafMs,
      });
    check(exactP16LightCensus(recovery.finaleReflectionLightCensus),
      'actual active-Finale reflection camera receives exact A1/H1/D1/S1/P16 with one directional shadow',
      recovery.finaleReflectionLightCensus);
    check(recovery.finaleOwnerPasses?.length === 1
        && recovery.finaleOwnerPasses[0].rendered === true
        && recovery.finaleOwnerPasses[0].error == null
        && recovery.finaleOwnerPasses[0].durationMs < 100
        && recovery.finaleOwnerPasses[0].programDelta === 0
        && recovery.finaleOwnerPasses[0].textureDelta === 0
        && recovery.finaleOwnerPasses[0].geometryDelta === 0,
      'Finale owner RT is certified once in a bounded hidden pass before glass is enabled',
      recovery.finaleOwnerPasses);
    const finaleUniverse = recovery.finaleOwnerUniverses
      ?.find((entry) => entry.finale > 0);
    const finaleFinalizerFrames = matchingFinalizerFrames(
      recovery.finaleFinalizers, recovery.finalizerFrames,
    );
    const finaleTerminalFrame = finaleFinalizerFrames.at(-1) || null;
    check(finaleUniverse?.covered === finaleUniverse?.total
        && finaleUniverse?.total === finaleUniverse?.finale
        && finaleUniverse?.finaleGeometries > 0
        && JSON.stringify(finaleUniverse?.coveredMembers)
          === JSON.stringify(finaleUniverse?.members)
        && finaleUniverse.exactCovered === finaleUniverse.exactTotal
        && finaleUniverse.exactTotal >= finaleUniverse.total
        && JSON.stringify(finaleUniverse.exactCoveredMembers)
          === JSON.stringify(finaleUniverse.exactMembers)
        && finaleUniverse.exactOnlyDecorative === finaleUniverse.exactOnlyMembers.length
        && (recovery.finaleOwnerBatches || []).length > 0
        && recovery.finaleOwnerBatches.every((entry) =>
          entry.physicalReady === true && entry.ownerPreloadObjects > 0
          && entry.ownerPreloadGeometries <= 16 && entry.geometryDelta <= 16
          && entry.durationMs < 100)
        && recovery.finaleOwnerExactBatches?.length > 0
        && recovery.finaleOwnerExactBatches.every(validExactPreload)
        && recovery.finaleOwnerExactBatches.every((entry) =>
          entry.key === finaleUniverse.key)
        && recovery.finaleOwnerExactBatches.every((entry) => entry.targetUuid != null)
        && recovery.finaleFinalizers?.length > 0
        && recovery.finaleFinalizers.every((entry) => entry.key === finaleUniverse.key)
        && finalizersOwnZeroDrawFrames(recovery.finaleFinalizers, finaleFinalizerFrames)
        && finaleTerminalFrame?.frameId < recovery.firstFinalePaneFrame?.frameId,
      'Finale owner scope converges across reduced/exact target batches and bounded finalization', {
        universe: finaleUniverse,
        batches: recovery.finaleOwnerBatches,
        exactBatches: recovery.finaleOwnerExactBatches,
        finalizers: recovery.finaleFinalizers,
        finalizerFrames: finaleFinalizerFrames,
        firstPaneFrame: recovery.firstFinalePaneFrame,
      });
    const finaleMotion = recovery.finaleMirrorMotion;
    check(finaleMotion?.panesActive > 0
        && finaleMotion?.ownerAfter === finaleMotion?.ownerBefore
        && finaleMotion?.after.programs === finaleMotion?.before.programs
        && finaleMotion?.after.textures === finaleMotion?.before.textures
        && finaleMotion?.after.geometries === finaleMotion?.before.geometries
        && finaleMotion?.frames?.length > 0
        && finaleMotion.frames.every((frame) => frame.afterPrograms === frame.beforePrograms
          && frame.afterTextures === frame.beforeTextures
          && frame.afterGeometries === frame.beforeGeometries
          && frame.ms < 100)
        && finaleMotion.timing?.frames?.length > 1
        && finaleMotion.timing.observedIntervals > 0
        && finaleMotion.timing.orderingErrors.length === 0
        && finaleMotion.maxRafMs < 100
        && finaleMotion.timing.maxRenderMs < 100
        && finaleMotion.timing.maxInterRenderIdleMs < 100
        && finaleMotion.timing.maxRenderCompletionIntervalMs < 100,
      'later Finale mirror-camera motion reveals no new program, texture, geometry, or owner pass',
      finaleMotion);
    check(exactP16LightCensus(finaleMotion?.reflectionLightCensus),
      'moved Finale reflection camera retains exact fixed light/shadow cardinality',
      finaleMotion?.reflectionLightCensus);
    const targetFailure = recovery.failureRecovery;
    check(targetFailure?.injectedAttempts === 2
        && targetFailure.failed.status === 'degraded'
        && targetFailure.failed.warmed === 3
        && JSON.stringify(targetFailure.failed.failedTargets) === '[0]'
        && targetFailure.failed.release === false
        && targetFailure.failed.render === false
        && targetFailure.failed.rewarming === true
        && targetFailure.failed.panesActive.every((active) => active === false),
      'persistent mirror-target bind failure retries twice, fails closed, and never reveals a pane',
      targetFailure);
    check(targetFailure?.recovered.status === 'ready'
        && targetFailure.recovered.generation === targetFailure.failed.generation
        && targetFailure.recovered.warmed === 4
        && targetFailure.recovered.failedTargets.length === 0
        && targetFailure.recovered.released === true
        && targetFailure.recovered.rewarming === false
        && targetFailure.recovered.panesActive.every((active) => active === true),
      'a bounded same-generation retry releases the shield and reactivates all panes',
      targetFailure);
    const readFailure = recovery.readFailureRecovery;
    check(readFailure?.injectedReadAttempts === 2
        && readFailure.failed.status === 'degraded'
        && readFailure.failed.warmed === 3
        && JSON.stringify(readFailure.failed.attempts) === '[2,1,1,1]'
        && JSON.stringify(readFailure.failed.failedTargets) === '[0]'
        && readFailure.failed.errors.some((error) =>
          error.includes('injected mirror target read failure'))
        && readFailure.failed.release === false
        && readFailure.failed.escaped === null
        && readFailure.failed.worldDrawCalls > 0
        && readFailure.failed.shielded === false
        && readFailure.failed.rewarming === true
        && readFailure.failed.panesActive.every((active) => active === false),
      'warm-stage getRenderTarget failures resolve degraded, keep the world live, and fail panes closed',
      readFailure);
    check(readFailure?.recovered.status === 'ready'
        && readFailure.recovered.generation === readFailure.failed.generation
        && readFailure.recovered.warmed === 4
        && readFailure.recovered.failedTargets.length === 0
        && readFailure.recovered.released === true
        && readFailure.recovered.rewarming === false
        && readFailure.recovered.panesActive.every((active) => active === true),
      'warm-stage target-read failure self-heals in the same GL generation', readFailure);
  }
  const houseFailures = report.houseFailures;
  check(houseFailures?.supported === true,
    'house mirror failure injection has WEBGL_lose_context coverage', houseFailures);
  if (houseFailures?.supported) {
    check(houseFailures.bindFailures === 2
        && houseFailures.bindFailed.shaderStatus === 'degraded'
        && houseFailures.bindFailed.target?.status === 'degraded'
        && houseFailures.bindFailed.target.attempts === 2
        && houseFailures.bindFailed.target.warmed === 0
        && houseFailures.bindFailed.worldDrawCalls > 0
        && houseFailures.bindFailed.paneActive === false
        && houseFailures.bindFailed.shielded === false,
      'persistent house-target bind failure retries twice while world stays live and pane stays dark',
      houseFailures);
    check(houseFailures.bindRecovered.shaderStatus === 'ready'
        && houseFailures.bindRecovered.generation === houseFailures.bindFailed.generation
        && houseFailures.bindRecovered.target?.status === 'ready'
        && houseFailures.bindRecovered.target.warmed === 1
        && houseFailures.bindRecovered.target.current === true
        && houseFailures.bindRecovered.residency?.generation
          === houseFailures.bindRecovered.generation
        && houseFailures.bindRecovered.residency.key
          === houseFailures.bindRecovered.residency.activeKey
        && houseFailures.bindRecovered.residency.key
          === houseFailures.bindRecovered.residency.progressKey
        && houseFailures.bindRecovered.residency.physical === true
        && houseFailures.bindRecovered.residency.queue === 0
        && houseFailures.bindRecovered.residency.ownerQueue === 0
        && houseFailures.bindRecovered.residency.ownerExactQueue === 0
        && houseFailures.bindRecovered.residency.ownerRecorded === true
        && houseFailures.bindRecovered.residency.ownerExactRecorded === true
        && houseFailures.bindRecovered.residency.universeRecorded === true
        && houseFailures.bindRecovered.residency.finalizerRecorded === true
        && houseFailures.bindRecovered.residency.ownerCertified === true
        && houseFailures.bindRecovered.residency.ownerPasses === 1
        && houseFailures.bindRecovered.mirrorActive === true
        && houseFailures.bindRecovered.paneActive === true
        && houseFailures.bindRecovered.visibleProgramDelta === 0
        && houseFailures.bindRecovered.visibleTextureDelta === 0
        && houseFailures.bindRecovered.visibleGeometryDelta === 0
        && houseFailures.bindRecovered.after.programs
          === houseFailures.bindRecovered.before.programs
        && houseFailures.bindRecovered.after.textures
          === houseFailures.bindRecovered.before.textures,
      'bounded same-generation retry certifies the hidden owner target before a zero-upload visible pane',
      houseFailures.bindRecovered);
    check(houseFailures.reflectionCompileFailures > 0
        && houseFailures.reflectionFailed.shaderStatus === 'degraded'
        && houseFailures.reflectionFailed.target?.status === 'ready'
        && !houseFailures.reflectionFailed.readyVariants.includes('house-reflection')
        && houseFailures.reflectionFailed.worldDrawCalls > 0
        && houseFailures.reflectionFailed.paneActive === false
        && houseFailures.reflectionFailed.shielded === false,
      'house RT-program failure leaves the playable world live and fails the pane closed',
      houseFailures.reflectionFailed);
    check(houseFailures.reflectionRecovered.shaderStatus === 'ready'
        && houseFailures.reflectionRecovered.generation
          === houseFailures.reflectionFailed.generation
        && houseFailures.reflectionRecovered.readyVariants.includes('house-reflection')
        && houseFailures.reflectionRecovered.target?.status === 'ready'
        && houseFailures.reflectionRecovered.mirrorActive === true
        && houseFailures.reflectionRecovered.paneActive === true
        && houseFailures.reflectionRecovered.visibleProgramDelta === 0
        && houseFailures.reflectionRecovered.visibleTextureDelta === 0
        && houseFailures.reflectionRecovered.visibleGeometryDelta === 0,
      'later same-generation retry recovers target-bound house programs without a visible compile',
      houseFailures.reflectionRecovered);
    check(houseFailures.houseRuntimeFaults === 1
        && houseFailures.houseRuntimeFailed.escaped === null
        && houseFailures.houseRuntimeFailed.poolInUpdate === false
        && houseFailures.houseRuntimeFailed.scopeVisible === true
        && houseFailures.houseRuntimeFailed.paneActive === false
        && houseFailures.houseRuntimeFailed.worldDrawCalls > 0
        && houseFailures.houseRuntimeFailed.shaderStatus === 'degraded'
        && houseFailures.houseRuntimeFailed.failure?.message
          ?.includes('injected live house pane render failure'),
      'a live house-pane render fault is contained, restores scope/latch, and fails only the pane closed',
      houseFailures.houseRuntimeFailed);
    check(houseFailures.houseRuntimeRecovered.generation
          === houseFailures.houseRuntimeFailed.generation
        && houseFailures.houseRuntimeRecovered.shaderStatus === 'ready'
        && houseFailures.houseRuntimeRecovered.target?.status === 'ready'
        && houseFailures.houseRuntimeRecovered.mirrorActive === true
        && houseFailures.houseRuntimeRecovered.paneActive === true
        && houseFailures.houseRuntimeRecovered.worldDrawCalls > 0,
      'the live house-pane fault automatically recovers in the same GL generation',
      houseFailures.houseRuntimeRecovered);
    check(houseFailures.finaleRuntimeFaults === 1
        && houseFailures.finaleRuntimeFailed.escaped === null
        && houseFailures.finaleRuntimeFailed.poolInUpdate === false
        && houseFailures.finaleRuntimeFailed.scopesVisible.every((visible) => visible === true)
        && houseFailures.finaleRuntimeFailed.panesActive.every((active) => active === false)
        && houseFailures.finaleRuntimeFailed.contextRewarming === true
        && houseFailures.finaleRuntimeFailed.worldDrawCalls > 0
        && houseFailures.finaleRuntimeFailed.failure?.message
          ?.includes('injected live Finale pane bind failure'),
      'a live Finale FBO bind fault is contained, restores every pane scope, and keeps the world live',
      houseFailures.finaleRuntimeFailed);
    check(houseFailures.finaleRuntimeRecovered.generation
          === houseFailures.finaleRuntimeFailed.generation
        && houseFailures.finaleRuntimeRecovered.shaderStatus === 'ready'
        && houseFailures.finaleRuntimeRecovered.targetStatus === 'ready'
        && houseFailures.finaleRuntimeRecovered.contextRewarming === false
        && houseFailures.finaleRuntimeRecovered.panesActive.some((active) => active === true)
        && houseFailures.finaleRuntimeRecovered.worldDrawCalls > 0,
      'the live Finale target fault automatically recovers in the same GL generation',
      houseFailures.finaleRuntimeRecovered);
  }
  for (const seam of report.race.transitions) {
    check(seam.visibleRenderProgramDelta === 0
        && seam.visibleRenderTextureDelta === 0
        && seam.visibleRenderGeometryDelta === 0,
      `${seam.name} race reveals no cold program, texture, or geometry upload`, seam);
    check(seam.orderingErrors?.length === 0 && seam.rafIntervals > 0
        && seam.renderCount > 1 && seam.maxRafMs < 100,
      `${seam.name} race observed callback cadence stays inside the cold-entry budget`, seam);
    check(seam.maxRenderMs < 100,
      `${seam.name} race render submission stays bounded`, seam);
    check(seam.maxInterRenderIdleMs < 100
        && seam.maxRenderCompletionIntervalMs < 100
        && seam.transitionMs < 100 && seam.cleanupMs < 100,
      `${seam.name} race inter-render idle and paint-ready cadence stay strictly sub-100ms`, seam);
    check(seam.worldSubmitted === true && seam.firstWorldMs != null
        && seam.firstWorldMs >= 0
        && seam.firstWorldMs <= 150 && seam.shieldDurationMs === 0
        && seam.shieldFrames === 0,
      `${seam.name} impossible-fast entry reveals a nonzero moving world within 150ms without a shield`, seam);
  }
  check(report.race.residentReturn?.worldSubmitted === true
      && report.race.residentReturn.orderingErrors?.length === 0
      && report.race.residentReturn.rafIntervals > 0
      && report.race.residentReturn.renderCount > 1
      && report.race.residentReturn.firstWorldMs >= 0
      && report.race.residentReturn.firstWorldMs < 100
      && report.race.residentReturn.visibleProgramDelta === 0
      && report.race.residentReturn.visibleTextureDelta === 0
      && report.race.residentReturn.visibleGeometryDelta === 0
      && report.race.residentReturn.maxRafMs < 100
      && report.race.residentReturn.maxInterRenderIdleMs < 100
      && report.race.residentReturn.maxRenderCompletionIntervalMs < 100,
    'a rapid forest return immediately delivers a zero-upload world while destination residency is re-earned',
    report.race.residentReturn);
  check(report.browserErrors.length === 0,
    'transition warmup scenarios emit zero browser errors', report.browserErrors);
} catch (error) {
  failures.push({ message: 'suite crashed', detail: error?.stack || `${error}` });
  console.error(error?.stack || error);
} finally {
  await raceBrowser?.close().catch(() => {});
  await contextBrowser?.close().catch(() => {});
  await failureBrowser?.close().catch(() => {});
  await settledBrowser?.close().catch(() => {});
  server.stop();
  report.failures = failures;
  writeFileSync(resultsPath('transition-warmup-regression.json'), JSON.stringify(report, null, 2));
}

if (failures.length) {
  console.error(`\n${failures.length} transition-warmup regression(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll transition-warmup regressions passed.');
}

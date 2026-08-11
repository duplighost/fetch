// Cold first-entry hitch gate for FETCH's exact shipped renderer path.
// Two fresh D3D11 contexts cover both adversarial timing and the settled path:
//   1) Wake immediately, then take the fastest debug story-order entries.
//   2) Wake immediately, prove warmup is state-pure, then profile every seam.
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
  verbChurn: null,
  continuousView: null,
  deferredDistricts: null,
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
    const renders = [];
    let wakeAt = null;
    let previous = null;
    let sampling = true;
    const raf = (timestamp) => {
      if (previous != null) intervals.push(timestamp - previous);
      previous = timestamp;
      if (sampling) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const realRender = g.render;
    g.render = function raceRender(...args) {
      const beforePrograms = g.renderer.info.programs?.length ?? 0;
      const beforeTextures = g.renderer.info.memory.textures;
      const beforeGeometries = g.renderer.info.memory.geometries;
      const startedAt = performance.now();
      try { return realRender.apply(this, args); }
      finally {
        renders.push({
          act: g.act,
          atMs: performance.now(),
          ms: performance.now() - startedAt,
          beforePrograms,
          afterPrograms: g.renderer.info.programs?.length ?? 0,
          beforeTextures,
          afterTextures: g.renderer.info.memory.textures,
          beforeGeometries,
          afterGeometries: g.renderer.info.memory.geometries,
          drawCalls: g.lastRender?.drawCalls || 0,
          shielded: !!g._shaderTransitionShield,
          reducedDetail: !!g.lastRender?.reducedDetail,
          residencyKey: g.lastRender?.residencyKey || null,
          visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
          visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
          visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
        });
      }
    };
    const warmupBeforeStart = g.shaderWarmup.status;
    const startAt = performance.now();
    wakeAt = startAt;
    F.start();
    const startMs = performance.now() - startAt;
    g._selfStep = true;
    g.teleport('house');
    const countPointLights = () => {
      let count = 0;
      g.scene.traverse((object) => { if (object.isPointLight) count++; });
      return count;
    };
    const impactRenderIndex = renders.length;
    const impactIntervalIndex = intervals.length;
    const impactBefore = {
      pointLights: countPointLights(),
      sceneChildren: g.scene.children.length,
      lightUuid: g._impactLight?.uuid || null,
      ringUuid: g._impactRing?.uuid || null,
      ringVisible: g._impactRing?.visible ?? null,
      bootPrime: g._impactRing?.userData?.bootPrime ?? null,
    };
    g.impact('locked', g.player.pos.clone().setY(g.player.pos.y + 1));
    for (let i = 0; i < 5; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
    const impactRenders = renders.slice(impactRenderIndex);
    const impactIntervals = intervals.slice(impactIntervalIndex);
    const firstImpact = {
      before: impactBefore,
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
      earlyPriorityKeys.push(g._shaderWarmPriorityKey());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    F.teleport('house');
    const earlyHousePriority = {
      keys: earlyPriorityKeys,
      restarts: (g._shaderWarmPriorityChanges || 0) - earlyPriorityBefore,
    };
    const fullHouseDeadline = wakeAt + 600;
    while (!renders.some((entry) => entry.atMs >= wakeAt && entry.drawCalls > 0
        && !entry.reducedDetail) && performance.now() < fullHouseDeadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const houseRenders = renders.filter((entry) => entry.atMs >= wakeAt);
    const firstHouseWorld = houseRenders.find((entry) => entry.drawCalls > 0) || null;
    const firstHouseFull = houseRenders.find((entry) => entry.drawCalls > 0
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
    for (const [name, act] of seams) {
      if (act === 'cave' && !g.flags.has('waterfallTaken')) {
        g.director.waterfallTaken();
        g.skull.vanish();
      }
      const renderIndex = renders.length;
      const intervalIndex = intervals.length;
      await new Promise((resolve) => requestAnimationFrame(resolve));
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
      const transitionMs = performance.now() - at;
      // Attack faster than human traversal, but wait up to the explicit brief
      // shield budget so a seam cannot pass merely because all eight sampled
      // frames were opaque. Ordinary gameplay should reveal much earlier.
      let sampledFrames = 0;
      const revealDeadline = performance.now() + 600;
      while (sampledFrames < 8
          || (!renders.slice(renderIndex).some((entry) => entry.drawCalls > 0)
            && performance.now() < revealDeadline)) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        sampledFrames++;
      }
      const seamRenders = renders.slice(renderIndex);
      const seamIntervals = intervals.slice(intervalIndex);
      const firstWorld = seamRenders.find((entry) => entry.drawCalls > 0) || null;
      const firstShield = seamRenders.find((entry) => entry.shielded) || null;
      const firstUnshieldAfter = firstShield
        ? seamRenders.find((entry) => !entry.shielded && entry.atMs >= firstShield.atMs)
        : null;
      transitions.push({
        name,
        transitionMs,
        maxRafMs: Math.max(0, ...seamIntervals),
        p95RafMs: (() => {
          const sorted = [...seamIntervals].sort((a, b) => a - b);
          return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1))] || 0;
        })(),
        maxRenderMs: Math.max(0, ...seamRenders.map((entry) => entry.ms)),
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
      });
      if (act === 'ossuary') {
        g.ossuary.inOssuary = false;
        F.stepWith(0.03, {}, false);
      }
    }
    const returnRenderIndex = renders.length;
    const returnIntervalIndex = intervals.length;
    const returnRestartCount = g._shaderWarmPriorityChanges || 0;
    const returnResidentBefore = [
      ...(g.currentGpuResidency?.physical || []),
      ...(g.currentGpuResidency?.reduced || []),
    ].some((key) => key.includes(':forest:forest'));
    const returnAt = performance.now();
    F.teleport('forest');
    let returnSamples = 0;
    const returnDeadline = performance.now() + 600;
    while (returnSamples < 8
        || (!renders.slice(returnRenderIndex).some((entry) => entry.drawCalls > 0)
          && performance.now() < returnDeadline)) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      returnSamples++;
    }
    const returnRenders = renders.slice(returnRenderIndex);
    const residentReturn = {
      residentBefore: returnResidentBefore,
      restarts: (g._shaderWarmPriorityChanges || 0) - returnRestartCount,
      worldSubmitted: returnRenders.some((entry) => entry.drawCalls > 0),
      firstWorldMs: (() => {
        const first = returnRenders.find((entry) => entry.drawCalls > 0);
        return first ? first.atMs - returnAt : null;
      })(),
      visibleProgramDelta: Math.max(0, ...returnRenders.map((entry) =>
        entry.visibleProgramDelta)),
      visibleTextureDelta: Math.max(0, ...returnRenders.map((entry) =>
        entry.visibleTextureDelta)),
      visibleGeometryDelta: Math.max(0, ...returnRenders.map((entry) =>
        entry.visibleGeometryDelta)),
      maxRafMs: Math.max(0, ...intervals.slice(returnIntervalIndex)),
    };
    sampling = false;
    g.render = realRender;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const postWakeRenders = renders.filter((entry) => entry.atMs >= wakeAt);
    const firstWorld = postWakeRenders.find((entry) => entry.drawCalls > 0) || null;
    const paint = Object.fromEntries(performance.getEntriesByType('paint')
      .map((entry) => [entry.name, entry.startTime]));
    return {
      warmupBeforeStart,
      startMs,
      maxRafMs: Math.max(0, ...intervals),
      p95RafMs: (() => {
        const sorted = [...intervals].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1))] || 0;
      })(),
      maxRenderMs: Math.max(0, ...renders.map((entry) => entry.ms)),
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
        physical: [...(g.currentGpuResidency?.physical || [])],
        reduced: [...(g.currentGpuResidency?.reduced || [])],
        owners: [...(g.currentGpuResidency?.owners || [])],
        exactPasses: [...(g.currentGpuResidency?.exactPasses || [])],
        reducedPasses: [...(g.currentGpuResidency?.reducedPasses || [])],
        ownerPasses: [...(g.currentGpuResidency?.ownerPasses || [])],
        ownerUniverses: [...(g.currentGpuResidency?.ownerUniverses || [])],
        deferredUniverses: [...(g.currentGpuResidency?.deferredUniverses || [])],
        skullWorldPasses: [...(g.currentGpuResidency?.skullWorldPasses || [])],
        maxExactMs: g.currentGpuResidency?.maxExactMs || 0,
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
  value.startMs = round(value.startMs);
  value.maxRafMs = round(value.maxRafMs);
  value.p95RafMs = round(value.p95RafMs);
  value.maxRenderMs = round(value.maxRenderMs);
  value.wakeToFirstWorldMs = round(value.wakeToFirstWorldMs);
  value.maxShieldDurationMs = round(value.maxShieldDurationMs);
  value.wakeHouse.wakeToFirstWorldMs = round(value.wakeHouse.wakeToFirstWorldMs);
  value.wakeHouse.wakeToFirstFullMs = round(value.wakeHouse.wakeToFirstFullMs);
  value.wakeHouse.maxShieldDurationMs = round(value.wakeHouse.maxShieldDurationMs);
  for (const key of ['maxRafMs', 'maxRenderMs']) value.firstImpact[key] = round(value.firstImpact[key]);
  for (const seam of value.transitions) {
    for (const key of [
      'transitionMs', 'maxRafMs', 'p95RafMs', 'maxRenderMs', 'firstWorldMs',
      'shieldDurationMs',
    ]) seam[key] = round(seam[key]);
  }
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
    const sampleRaf = (timestamp) => {
      if (previousRaf != null) intervals.push(timestamp - previousRaf);
      previousRaf = timestamp;
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
      const sampleRaf = (timestamp) => {
        if (previousRaf != null) intervals.push(timestamp - previousRaf);
        previousRaf = timestamp;
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
    const collectRenderableIds = (roots) => {
      const ids = new Set();
      for (const root of roots) root?.traverse((object) => {
        if ((object.isMesh || object.isLine || object.isPoints)
            && object.geometry && object.material) ids.add(object.uuid);
      });
      return [...ids].sort();
    };
    const intervals = [];
    let previous = null;
    let sampling = true;
    const raf = (timestamp) => {
      if (previous != null) intervals.push(timestamp - previous);
      previous = timestamp;
      if (sampling) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const beforeSkullResidency = skullResidencyState();
    const startedAt = performance.now();
    F.start();
    const startMs = performance.now() - startedAt;
    // startGame deliberately initializes WebAudio in a user-gesture microtask.
    // Purity begins after that authored startup transaction, not before it, so
    // the shader compiler cannot be blamed for the expected false -> true edge.
    await Promise.resolve();
    // Keep deterministic gameplay time frozen while the asynchronous compiler
    // runs. Test-mode rAF still renders every frame, so this isolates warmup
    // purity from ordinary Director timers, enemy age and story progression.
    g._selfStep = false;
    const afterStart = state();
    const deadline = performance.now() + 90000;
    while (['scheduled', 'pending'].includes(g.shaderWarmup.status) && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    // Mirror-universe uploads are explicitly non-blocking for the physical
    // room. Let the background phase finish so its complete membership can be
    // inspected without conflating that wait with Wake/first-world timing.
    const ownerDeadline = performance.now() + 30000;
    while (!(g.currentGpuResidency?.ownerUniverses || []).some((entry) => entry.house > 0)
        && performance.now() < ownerDeadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const afterWarm = state();
    sampling = false;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      startMs,
      afterStart,
      afterWarm,
      beforeSkullResidency,
      afterSkullResidency: skullResidencyState(),
      expectedHouseOwnerMembers: collectRenderableIds([
        ...(g.staticWorldRenderRoots || []),
        ...(g.houseRenderRoots || []),
        ...(g.graveyardRenderRoots || []),
        g.atmosphere?.group,
        g.houseMirror?.double,
        g.houseMirror?.echo,
      ]),
      intervals,
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
        reducedPasses: [...(g.currentGpuResidency?.reducedPasses || [])],
        ownerPasses: [...(g.currentGpuResidency?.ownerPasses || [])],
        ownerUniverses: [...(g.currentGpuResidency?.ownerUniverses || [])],
        skullWorldPasses: [...(g.currentGpuResidency?.skullWorldPasses || [])],
        maxExactMs: g.currentGpuResidency?.maxExactMs || 0,
        maxReducedPrimeMs: g.currentGpuResidency?.maxReducedPrimeMs || 0,
        maxOwnerMs: g.currentGpuResidency?.maxOwnerMs || 0,
        ownerFullFrames: g.currentGpuResidency?.ownerFullFrames || 0,
        deferredFullFrames: g.currentGpuResidency?.deferredFullFrames || 0,
        errors: [...(g.currentGpuResidency?.errors || [])],
      },
    };
  });

  const settled = [];
  await page.evaluate(() => {
    const g = window.__game;
    g._selfStep = false;
    g.teleport('house');
  });
  for (const [name, act] of SEAMS) {
    const seam = await page.evaluate(async ({ name, act }) => {
      const g = window.__game, F = window.__FETCH;
      const intervals = [], renders = [], steps = [];
      const realRender = g.render, realStep = g.step;
      const before = {
        act: g.act,
        programs: g.renderer.info.programs?.length ?? 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      };
      g.render = function measuredRender(...args) {
        const at = performance.now();
        try { return realRender.apply(this, args); }
        finally {
          renders.push({
            atMs: performance.now(),
            ms: performance.now() - at,
            drawCalls: g.lastRender?.drawCalls || 0,
            shielded: !!g._shaderTransitionShield,
            reducedDetail: !!g.lastRender?.reducedDetail,
            residencyKey: g.lastRender?.residencyKey || null,
            visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
            visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
            visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
          });
        }
      };
      g.step = function measuredStep(...args) {
        const at = performance.now();
        try { return realStep.apply(this, args); }
        finally { steps.push(performance.now() - at); }
      };
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
      const transitionMs = performance.now() - transitionAt;
      let previous = null;
      await new Promise((resolve) => {
        const sample = (timestamp) => {
          if (previous != null) intervals.push(timestamp - previous);
          previous = timestamp;
          if (intervals.length >= 70) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const originalView = { yaw: g.player.yaw, pitch: g.player.pitch };
      const sweepFrames = [];
      const sweepIntervals = [];
      let previousSweep = null;
      for (let turn = 0; turn < 4; turn++) {
        g.player.yaw = originalView.yaw + turn * Math.PI / 2;
        g.player.pitch = originalView.pitch;
        g.player._sync(0);
        const renderStart = renders.length;
        const timestamp = await new Promise((resolve) => requestAnimationFrame(resolve));
        if (previousSweep != null) sweepIntervals.push(timestamp - previousSweep);
        previousSweep = timestamp;
        sweepFrames.push(renders[renderStart] || null);
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
      if (act === 'ossuary') {
        g.ossuary.inOssuary = false;
        F.stepWith(0.03, {}, false);
      }
      return {
        name,
        before,
        after,
        transitionMs,
        maxRafMs: Math.max(...intervals),
        intervals,
        maxRenderMs: Math.max(...renders.map((entry) => entry.ms)),
        firstWorldMs: (() => {
          const first = renders.find((entry) => entry.atMs >= transitionAt && entry.drawCalls > 0);
          return first ? first.atMs - transitionAt : null;
        })(),
        worldSubmitted: renders.some((entry) => entry.atMs >= transitionAt && entry.drawCalls > 0),
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
    for (const key of [
      'transitionMs', 'maxRafMs', 'p95RafMs', 'maxRenderMs', 'maxStepMs', 'firstWorldMs',
      'sweepMaxRafMs',
    ]) {
      seam[key] = round(seam[key]);
    }
    for (const frame of seam.sweepFrames || []) if (frame) frame.ms = round(frame.ms);
    settled.push(seam);
  }
  const caveTail = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    g._selfStep = false;
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('cave');
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
  for (const key of ['maxStepMs', 'p95StepMs', 'p99StepMs']) caveTail[key] = round(caveTail[key]);
  // Verb ownership must be measured in a fresh legal pre-waterfall world. The
  // settled route has already sacrificed the skull; reattaching it there would
  // create an impossible P18 light rig and attribute that harness-only compile
  // cliff to throw, flame, key and mirror gameplay.
  const verbOpened = await openPage(browser, report.url);
  const verbPage = verbOpened.page;
  await ready(verbPage);
  const verbChurn = await verbPage.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
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
    const collectRenderableIds = (roots) => {
      const ids = new Set();
      for (const root of roots) root?.traverse((object) => {
        if ((object.isMesh || object.isLine || object.isPoints)
            && object.geometry && object.material) ids.add(object.uuid);
      });
      return [...ids].sort();
    };
    F.start();
    g._selfStep = false;
    F.teleport('house');
    g.skull.holdNow();
    g.houseMirror.awakened = false;
    const residencyDeadline = performance.now() + 90000;
    while (performance.now() < residencyDeadline) {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      if (g.shaderWarmup?.status === 'ready'
          && residency?.physical?.has(g._currentGpuResidencyKey())
          && progress?.ownerRecorded && progress.ownerQueue.length === 0
          && !g.lastRender?.reducedDetail) break;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const residency = g.currentGpuResidency;
    const progress = residency?.progressive;
    if (g.shaderWarmup?.status !== 'ready'
        || !residency?.physical?.has(g._currentGpuResidencyKey())
        || !progress?.ownerRecorded || progress.ownerQueue.length
        || g.lastRender?.reducedDetail) {
      throw new Error('fresh legal verb page did not reach settled house residency');
    }

    const renders = [];
    const intervals = [];
    let previous = null;
    let sampling = true;
    const sample = (timestamp) => {
      if (previous != null) intervals.push(timestamp - previous);
      previous = timestamp;
      if (sampling) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const realRender = g.render;
    g.render = function measuredVerbRender(...args) {
      const at = performance.now();
      const result = realRender.apply(this, args);
      renders.push({
        at: performance.now(),
        ms: performance.now() - at,
        reducedDetail: !!g.lastRender?.reducedDetail,
        programDelta: g.lastRender?.visibleProgramDelta || 0,
        textureDelta: g.lastRender?.visibleTextureDelta || 0,
        geometryDelta: g.lastRender?.visibleGeometryDelta || 0,
        paneActive: !!g.houseMirror?.pane?.active,
        ownerPasses: g.currentGpuResidency?.ownerPasses?.length || 0,
      });
      return result;
    };
    const measure = async (label, action, frames = 6) => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const renderIndex = renders.length;
      const intervalIndex = intervals.length;
      const exactBefore = g.currentGpuResidency?.exactPasses?.length || 0;
      const ownerBefore = g.currentGpuResidency?.ownerPasses?.length || 0;
      action();
      for (let i = 0; i < frames; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const sampleRenders = renders.slice(renderIndex);
      g._syncShaderBallast();
      return {
        label,
        exactBefore,
        exactAfter: g.currentGpuResidency?.exactPasses?.length || 0,
        ownerBefore,
        ownerAfter: g.currentGpuResidency?.ownerPasses?.length || 0,
        maxRafMs: Math.max(0, ...intervals.slice(intervalIndex)),
        maxRenderMs: Math.max(0, ...sampleRenders.map((entry) => entry.ms)),
        maxVisibleProgramDelta: Math.max(0, ...sampleRenders.map((entry) => entry.programDelta)),
        maxVisibleTextureDelta: Math.max(0, ...sampleRenders.map((entry) => entry.textureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...sampleRenders.map((entry) => entry.geometryDelta)),
        reducedFrames: sampleRenders.filter((entry) => entry.reducedDetail).length,
        firstFrame: sampleRenders[0] || null,
        firstPaneFrame: sampleRenders.find((entry) => entry.paneActive) || null,
        ownerPasses: [...(g.currentGpuResidency?.ownerPasses || [])].slice(ownerBefore),
        reflectionLightCensus: g.houseMirror?.pane?.active
          ? lightCensus(g.houseMirror.pool._vcam) : null,
      };
    };

    const cases = [];
    cases.push(await measure('first-throw', () => {
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      F.stepWith(0.12, { throwHeld: true }, false);
    }));
    cases.push(await measure('catch-return', () => {
      F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
      for (let i = 0; i < 300 && g.skull.mode !== 'held'; i++) {
        F.stepWith(1 / 120, {}, false);
      }
      if (g.skull.mode !== 'held') g.skull.holdNow();
    }));

    const keyTarget = g.world.fetchTargets.find((target) => target.id === 'treeKey');
    cases.push(await measure('bedroom-key-carry', () => {
      if (!keyTarget?.object) throw new Error('treeKey target missing');
      keyTarget.onHit.call(keyTarget, g.skull);
      g.skull.holdNow();
    }));
    const droppedKey = g.skull.dropCarry();
    if (droppedKey?.mesh) droppedKey.mesh.visible = false;

    cases.push(await measure('flame-absorb', () => {
      const source = g.flameCircuit?.sources?.[0];
      if (!source || !g.flameCircuit.absorb(g.skull, source)) {
        throw new Error('flame source could not be absorbed');
      }
      for (let i = 0; i < 90; i++) F.stepWith(1 / 120, {}, false);
    }, 8));

    cases.push(await measure('offscreen-stage-evolution', () => {
      const wasVisible = g.skull.root.visible;
      g.skull.root.visible = false;
      g.skull.setStage(Math.min(5, g.skull.stage + 1));
      g.skull.root.visible = wasVisible;
    }));

    cases.push(await measure('awakened-mirror-approach', () => {
      g.houseMirror.awakened = true;
      g.player.pos.set(g.houseMirror.pos.x + 2.1, 0, g.houseMirror.pos.z);
      g.player.yaw = Math.PI / 2;
      g.player.pitch = 0;
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
    }, 8));
    cases.push(await measure('awakened-mirror-motion', () => {
      const mirror = g.houseMirror.pos;
      g.player.pos.set(mirror.x + 1.7, 0, mirror.z + 1.1);
      const dx = mirror.x - g.player.pos.x;
      const dz = mirror.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = -0.04;
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
    }, 8));

    sampling = false;
    g.render = realRender;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      cases,
      residencyErrors: [...(g.currentGpuResidency?.errors || [])],
      ownerUniverses: [...(g.currentGpuResidency?.ownerUniverses || [])],
      expectedHouseOwnerMembers: collectRenderableIds([
        ...(g.staticWorldRenderRoots || []),
        ...(g.houseRenderRoots || []),
        ...(g.graveyardRenderRoots || []),
        g.atmosphere?.group,
        g.houseMirror?.double,
        g.houseMirror?.echo,
      ]),
    };
  });
  for (const entry of verbChurn.cases) {
    entry.maxRafMs = round(entry.maxRafMs);
    entry.maxRenderMs = round(entry.maxRenderMs);
    for (const owner of entry.ownerPasses || []) owner.durationMs = round(owner.durationMs);
  }
  report.browserErrors.push(...verbOpened.errors.map((error) => `fresh-verbs: ${error}`));
  await verbPage.close();
  const gl = await page.evaluate(() => {
    const context = window.__game.renderer.getContext();
    const info = context.getExtension('WEBGL_debug_renderer_info');
    return info
      ? context.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER);
  });
  report.browserErrors.push(...opened.errors.map((error) => `settled: ${error}`));
  await page.close();
  return { purity, settled, caveTail, verbChurn, renderer: gl };
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
    const waitFor = async (predicate, label, timeout = 90000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      if (!predicate()) throw new Error(`context recovery timed out: ${label}`);
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
    const collectRenderableIds = (roots) => {
      const ids = new Set();
      for (const root of roots) root?.traverse((object) => {
        if ((object.isMesh || object.isLine || object.isPoints)
            && object.geometry && object.material) ids.add(object.uuid);
      });
      return [...ids].sort();
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
    let activeRestoreProbe = null;
    const originalGameRender = g.render;
    g.render = function measuredRestoreWorld(...args) {
      const at = performance.now();
      const beforePrograms = g.renderer.info.programs?.length || 0;
      const beforeTextures = g.renderer.info.memory.textures;
      const beforeGeometries = g.renderer.info.memory.geometries;
      const rendered = originalGameRender.apply(this, args);
      if (activeRestoreProbe?.restoredAt != null) {
        activeRestoreProbe.frames.push({
          at,
          ms: performance.now() - at,
          act: g.act,
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
        });
      }
      return rendered;
    };
    const beginRestoreProbe = (label) => {
      const probe = { label, restoredAt: null, frames: [] };
      restoreProbes.push(probe);
      activeRestoreProbe = probe;
      return probe;
    };
    const markRestored = (probe) => { probe.restoredAt = performance.now(); };
    const waitForRestoreReveal = async (probe) => {
      await waitFor(() => probe.frames.some((frame) =>
        frame.at >= probe.restoredAt && frame.worldDrawCalls > 0 && !frame.shielded),
      `${probe.label} first restored world`, 20000);
      probe.playableAt = performance.now();
    };
    const waitForRestoreExact = async (probe) => {
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
      if (activeRestoreProbe === probe) activeRestoreProbe = null;
    };
    const summarizeRestoreProbe = (probe) => {
      const frames = probe.frames.filter((frame) => frame.at >= probe.restoredAt
        && (probe.completedAt == null || frame.at <= probe.completedAt));
      const intervals = frames.slice(1).map((frame, index) => frame.at - frames[index].at);
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
        maxRafMs: Math.max(0, ...intervals),
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
          && g.lastRender?.drawCalls > 0 && !alreadyCapturedKind) {
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
    await waitFor(() => g.shaderWarmup?.status === 'ready', 'ready after pending loss');
    await waitForRestoreExact(houseRestoreProbe);
    await waitFor(() => recoveredHouseFrames.some((frame) => !frame.reducedDetail),
      'first exact recovered house frame');
    g.render = realRecoveredHouseRender;
    stages.push(mark('ready-after-pending-loss'));
    const afterPendingRecovery = state();
    await waitFor(() => (g.currentGpuResidency?.ownerUniverses || [])
      .some((entry) => entry.house > 0), 'restored house owner universe', 30000);

    const measureHouseView = async (kind) => {
      F.teleport('house');
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
      const before = {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      };
      const ownerPassIndex = g.currentGpuResidency?.ownerPasses?.length || 0;
      let previous = null;
      const intervals = [];
      const visibleFrames = [];
      await new Promise((resolve) => {
        const sample = (timestamp) => {
          if (previous != null) intervals.push(timestamp - previous);
          previous = timestamp;
          visibleFrames.push({
            reducedDetail: !!g.lastRender?.reducedDetail,
            worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
            programDelta: g.lastRender?.visibleProgramDelta || 0,
            textureDelta: g.lastRender?.visibleTextureDelta || 0,
            geometryDelta: g.lastRender?.visibleGeometryDelta || 0,
            residencyKey: g.lastRender?.residencyKey || null,
            paneActive: !!g.houseMirror?.pane?.active,
            mirrorActive: !!g.houseMirror?.active,
          });
          if (intervals.length >= 8) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      g._syncShaderBallast();
      return {
        kind,
        before,
        after: {
          programs: g.renderer.info.programs?.length || 0,
          textures: g.renderer.info.memory.textures,
          geometries: g.renderer.info.memory.geometries,
        },
        maxRafMs: Math.max(0, ...intervals),
        reducedFrames: visibleFrames.filter((frame) => frame.reducedDetail).length,
        maxVisibleProgramDelta: Math.max(0, ...visibleFrames.map((frame) => frame.programDelta)),
        maxVisibleTextureDelta: Math.max(0, ...visibleFrames.map((frame) => frame.textureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...visibleFrames.map((frame) => frame.geometryDelta)),
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
        } : null,
      };
    };
    const restoredHouseViews = [
      await measureHouseView('window'),
      await measureHouseView('mirror'),
      await measureHouseView('mirror-motion'),
    ];
    const restoredHouseOwnerUniverses = [...(g.currentGpuResidency?.ownerUniverses || [])];
    const restoredHouseOwnerBatches = [...(g.currentGpuResidency?.reducedPasses || [])]
      .filter((entry) => entry.kind === 'owner-preload-batch');
    const expectedHouseOwnerMembers = collectRenderableIds([
      ...(g.staticWorldRenderRoots || []),
      ...(g.houseRenderRoots || []),
      ...(g.graveyardRenderRoots || []),
      g.atmosphere?.group,
      g.houseMirror?.double,
      g.houseMirror?.echo,
    ]);
    const restoredImpactBefore = {
      programs: g.renderer.info.programs?.length || 0,
      textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries,
      lightUuid: g._impactLight?.uuid || null,
      ringUuid: g._impactRing?.uuid || null,
    };
    const restoredImpactIntervals = [];
    let restoredImpactPrevious = null;
    g.impact('locked', g.player.pos.clone().setY(g.player.pos.y + 1));
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => requestAnimationFrame((timestamp) => {
        if (restoredImpactPrevious != null) {
          restoredImpactIntervals.push(timestamp - restoredImpactPrevious);
        }
        restoredImpactPrevious = timestamp;
        resolve();
      }));
    }
    const restoredImpact = {
      before: restoredImpactBefore,
      after: {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
        lightUuid: g._impactLight?.uuid || null,
        ringUuid: g._impactRing?.uuid || null,
      },
      maxRafMs: Math.max(0, ...restoredImpactIntervals),
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
    activateDormantPool(g.goreMesh, -0.15);
    activateDormantPool(g.enemies.stainPool, 0.15);
    let dynamicPrevious = null;
    const dynamicIntervals = [];
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => requestAnimationFrame((timestamp) => {
        if (dynamicPrevious != null) dynamicIntervals.push(timestamp - dynamicPrevious);
        dynamicPrevious = timestamp;
        resolve();
      }));
    }
    const dynamicPoolActivation = {
      before: dynamicBefore,
      after: {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
        goreCount: g.goreMesh.count,
        stainCount: g.enemies.stainPool.count,
      },
      maxRafMs: Math.max(0, ...dynamicIntervals),
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
    await waitFor(() => g.shaderWarmup?.status === 'ready', 'ready after outbound skull loss');
    await waitForRestoreExact(outboundRestoreProbe);
    const outboundAfter = skullFlightState();
    const outboundResidency = {
      reducedPasses: [...(g.currentGpuResidency?.reducedPasses || [])],
      exactPasses: [...(g.currentGpuResidency?.exactPasses || [])],
      skullWorldPasses: [...(g.currentGpuResidency?.skullWorldPasses || [])],
      errors: [...(g.currentGpuResidency?.errors || [])],
    };
    stages.push(mark('ready-after-outbound-skull-loss'));
    g.skull.holdNow();

    // 3. Restore with a real live Choir. Its owned light must be isolated from
    // ordinary/finale rigs while still contributing the cave-threat signature.
    // This is the exact late-game state a context loss can interrupt in play.
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('cave');
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
    await waitFor(() => g.shaderWarmup?.status === 'ready', 'ready after live Choir loss');
    await waitForRestoreExact(caveRestoreProbe);
    stages.push(mark('ready-after-live-choir-loss'));
    const afterReadyRecovery = state();

    const measureAct = async (act, label = act) => {
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
      let previous = null;
      const intervals = [];
      const visibleFrames = [];
      await new Promise((resolve) => {
        const sample = (timestamp) => {
          if (previous != null) intervals.push(timestamp - previous);
          previous = timestamp;
          visibleFrames.push({
            reducedDetail: !!g.lastRender?.reducedDetail,
            worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
            programDelta: g.lastRender?.visibleProgramDelta || 0,
            textureDelta: g.lastRender?.visibleTextureDelta || 0,
            geometryDelta: g.lastRender?.visibleGeometryDelta || 0,
            residencyKey: g.lastRender?.residencyKey || null,
          });
          if (intervals.length >= 16) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const result = {
        act,
        label,
        before,
        after: {
          programs: g.renderer.info.programs?.length || 0,
          textures: g.renderer.info.memory.textures,
          geometries: g.renderer.info.memory.geometries,
        },
        maxRafMs: Math.max(...intervals),
        worldSubmitted: (g.lastRender?.worldDrawCalls || 0) > 0,
        shielded: !!g._shaderTransitionShield,
        reducedFrames: visibleFrames.filter((frame) => frame.reducedDetail).length,
        maxVisibleProgramDelta: Math.max(0, ...visibleFrames.map((frame) => frame.programDelta)),
        maxVisibleTextureDelta: Math.max(0, ...visibleFrames.map((frame) => frame.textureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...visibleFrames.map((frame) => frame.geometryDelta)),
        residencyKey: g.lastRender?.residencyKey || null,
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
      if (act === 'ossuary') {
        g.ossuary.inOssuary = false;
        F.stepWith(0.03, {}, false);
      }
      return result;
    };
    const seams = [
      await measureAct('cave', 'hatch-with-live-choir'),
      await measureAct('ossuary', 'ossuary-after-choir-retirement'),
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
    const restoreIntervals = [];
    let restorePrevious = null;
    let sampleRestore = true;
    const sampleRestoreRaf = (timestamp) => {
      if (restorePrevious != null) restoreIntervals.push(timestamp - restorePrevious);
      restorePrevious = timestamp;
      if (sampleRestore) requestAnimationFrame(sampleRestoreRaf);
    };
    requestAnimationFrame(sampleRestoreRaf);
    await contextEvent('webglcontextlost', () => lose.loseContext());
    stages.push(mark('lost-with-active-finale'));
    if (!g.finale._contextRewarming) throw new Error('active Finale was not shielded on context loss');
    const finaleRestoreProbe = beginRestoreProbe('active-finale');
    await restoreContext();
    markRestored(finaleRestoreProbe);
    recordReflections = true;
    await waitForRestoreReveal(finaleRestoreProbe);
    await waitFor(() => g.shaderWarmup?.status === 'ready'
      && g.finale._targetWarmState?.status === 'ready'
      && !g.finale._contextRewarming, 'active Finale generation ready');
    await waitForRestoreExact(finaleRestoreProbe);
    await waitFor(() => reflectionFrames.length > 0, 'first restored reflection');
    g._syncShaderBallast();
    const finaleReflectionLightCensus = lightCensus(g.finale.mirrors._vcam);
    const finaleMotionFrameIndex = reflectionFrames.length;
    const finaleMotionIntervalIndex = restoreIntervals.length;
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
    for (let index = 0; index < 4; index++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const finaleMotionFrames = reflectionFrames.slice(finaleMotionFrameIndex);
    const finaleMirrorMotion = {
      before: finaleMotionBefore,
      after: {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
        geometries: g.renderer.info.memory.geometries,
      },
      frames: finaleMotionFrames,
      maxRafMs: Math.max(0, ...restoreIntervals.slice(finaleMotionIntervalIndex)),
      ownerBefore: finaleMotionOwnerBefore,
      ownerAfter: g.currentGpuResidency?.ownerPasses?.length || 0,
      panesActive: g.finale.panes.filter((pane) => pane.active).length,
      reflectionLightCensus: lightCensus(g.finale.mirrors._vcam),
    };
    stages.push(mark('ready-after-active-finale-loss'));
    sampleRestore = false;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    g.finale.render = realFinaleRender;
    const afterActiveFinaleRecovery = state();
    const firstRestoredReflection = reflectionFrames[0];
    const restoredFinaleOwnerPasses = [...(g.currentGpuResidency?.ownerPasses || [])]
      .slice(finaleOwnerPassIndex).filter((entry) => entry.kind === 'finale');
    const restoredFinaleOwnerUniverses = [...(g.currentGpuResidency?.ownerUniverses || [])];
    const restoredFinaleOwnerBatches = [...(g.currentGpuResidency?.reducedPasses || [])]
      .filter((entry) => entry.kind === 'owner-preload-batch');
    const expectedFinaleOwnerMembers = collectRenderableIds([
      ...(g.staticWorldRenderRoots || []),
      ...(g.finale?.warmRoots || []),
      g.finale?.figure,
      g.finale?.figure?.userData?.exactHead,
    ]);
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
      restoredHouseViews,
      restoredHouseOwnerUniverses,
      restoredHouseOwnerBatches,
      expectedHouseOwnerMembers,
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
      expectedFinaleOwnerMembers,
      activeRestoreMaxRafMs: Math.max(0, ...restoreIntervals),
      restoreProbes: restoreProbes.map(summarizeRestoreProbe),
      failureRecovery,
      readFailureRecovery,
    };
  });
  report.browserErrors.push(...opened.errors.map((error) => `context: ${error}`));
  await page.close();
  for (const seam of value.seams || []) seam.maxRafMs = round(seam.maxRafMs);
  for (const view of value.restoredHouseViews || []) view.maxRafMs = round(view.maxRafMs);
  for (const probe of value.restoreProbes || []) {
    for (const key of ['firstWorldMs', 'firstFullMs', 'shieldDurationMs', 'maxRafMs', 'maxRenderMs']) {
      probe[key] = round(probe[key]);
    }
    if (probe.exactPass) probe.exactPass.durationMs = round(probe.exactPass.durationMs);
  }
  if (value.firstRecoveredHouseFrame) value.firstRecoveredHouseFrame.ms =
    round(value.firstRecoveredHouseFrame.ms);
  if (value.firstRecoveredHouseFullFrame) value.firstRecoveredHouseFullFrame.ms =
    round(value.firstRecoveredHouseFullFrame.ms);
  if (value.restoredImpact) value.restoredImpact.maxRafMs = round(value.restoredImpact.maxRafMs);
  if (value.dynamicPoolActivation) value.dynamicPoolActivation.maxRafMs =
    round(value.dynamicPoolActivation.maxRafMs);
  value.activeRestoreMaxRafMs = round(value.activeRestoreMaxRafMs);
  if (value.firstRestoredReflection) value.firstRestoredReflection.ms = round(value.firstRestoredReflection.ms);
  if (value.finaleMirrorMotion) {
    value.finaleMirrorMotion.maxRafMs = round(value.finaleMirrorMotion.maxRafMs);
    for (const frame of value.finaleMirrorMotion.frames || []) frame.ms = round(frame.ms);
  }
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
        errors: [...g._houseMirrorTargetWarmState.errors],
      } : null,
      drawCalls: g.lastRender?.drawCalls || 0,
      paneActive: g.houseMirror.pane.active,
      mirrorActive: g.houseMirror.active,
      shielded: !!g._shaderTransitionShield,
      reducedDetail: !!g.lastRender?.reducedDetail,
      visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
      visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
      visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
    });
    const placeAtMirror = () => {
      F.teleport('house');
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
    await waitFor(() => g.shaderWarmup?.status === 'degraded', 'initial bind degradation');
    await frame();
    const bindFailed = resourceSnapshot();
    renderer.setRenderTarget = originalSetRenderTarget;

    await waitFor(() => g.shaderWarmup?.status === 'ready'
      && g.shaderWarmup.generation === bindFailed.generation
      && g._houseMirrorTargetWarmState?.status === 'ready',
    'same-generation bind recovery ready');
    placeAtMirror();
    const bindRecoveryBefore = {
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
    };
    await frame();
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
    await waitFor(() => g.shaderWarmup?.status === 'degraded', 'reflection degradation');
    placeAtMirror();
    await frame();
    const reflectionFailed = resourceSnapshot();
    g._compileWarmVariant = originalCompile;

    await waitFor(() => g.shaderWarmup?.status === 'ready'
      && g.shaderWarmup.generation === reflectionFailureGeneration
      && g._houseMirrorTargetWarmState?.status === 'ready',
    'same-generation reflection recovery ready');
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
    await waitFor(() => g.shaderWarmup?.status === 'ready'
      && g.shaderWarmup.generation === houseRuntimeGeneration
      && g._houseMirrorTargetWarmState?.status === 'ready',
    'live house pane recovery');
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
    await waitFor(() => g.shaderWarmup?.status === 'ready'
      && g.currentGpuResidency?.physical?.has(g._currentGpuResidencyKey())
      && !g.lastRender?.reducedDetail,
    'active Finale physical residency');
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
      escaped: finaleRuntimeEscaped,
      poolInUpdate: g.finale.mirrors._inUpdate,
      scopesVisible: g.finale.panes.map((pane) => pane.mesh.visible),
      panesActive: g.finale.panes.map((pane) => pane.active),
      contextRewarming: g.finale._contextRewarming,
      failure: g.finale.mirrors.lastFailure,
    };
    const finaleRuntimeGeneration = g._webglGeneration;
    await waitFor(() => g.shaderWarmup?.status === 'ready'
      && g.shaderWarmup.generation === finaleRuntimeGeneration
      && g.finale._targetWarmState?.status === 'ready',
    'live Finale pane recovery');
    await frame();
    const finaleRuntimeRecovered = {
      generation: g._webglGeneration,
      shaderStatus: g.shaderWarmup?.status,
      targetStatus: g.finale._targetWarmState?.status,
      contextRewarming: g.finale._contextRewarming,
      panesActive: g.finale.panes.map((pane) => pane.active),
      drawCalls: g.lastRender?.drawCalls || 0,
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
  report.continuousView = await runContinuousViewResidency(settledBrowser);
  report.deferredDistricts = await runDeferredDistrictResidency(settledBrowser);
  const result = await runPurityAndSettled(settledBrowser);
  report.purity = result.purity;
  report.settled = result.settled;
  report.caveTail = result.caveTail;
  report.verbChurn = result.verbChurn;
  report.renderer = result.renderer;

  const same = (a, b, key) => JSON.stringify(a[key]) === JSON.stringify(b[key]);
  const { afterStart, afterWarm } = report.purity;
  check(report.purity.startMs < 50,
    'Wake Up returns in under 50ms without waiting on warmup',
    { startMs: round(report.purity.startMs) });
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
        && entry.durationMs <= 100)
      && report.purity.residency.exactPasses.every((entry) =>
        entry.error == null && entry.programDelta === 0
        && entry.textureDelta === 0 && entry.geometryDelta === 0)
      && report.purity.residency.maxExactMs <= 100
      && report.purity.residency.maxReducedPrimeMs <= 100
      && report.purity.residency.skullWorldPasses?.length === 1
      && report.purity.residency.skullWorldPasses[0].tether === true
      && report.purity.residency.skullWorldPasses[0].stateRestored === true
      && report.purity.residency.skullWorldPasses[0].programDelta === 0
      && report.purity.residency.skullWorldPasses[0].textureDelta === 0
      && report.purity.residency.skullWorldPasses[0].geometryDelta === 0
      && report.purity.residency.errors.length === 0,
    'current-view geometry uploads in <=16-geometry paint batches before one bounded exact pass, including the hidden WORLD/P16 skull+tether pass',
    report.purity.residency);
  const houseOwnerUniverse = report.purity.residency?.ownerUniverses
    ?.find((entry) => entry.house > 0);
  const houseOwnerBatches = report.purity.residency?.reducedPasses
    ?.filter((entry) => entry.kind === 'owner-preload-batch') || [];
  check(houseOwnerUniverse?.house > 0
      && houseOwnerUniverse.total === houseOwnerUniverse.house
      && houseOwnerUniverse.houseGeometries > 0
      && houseOwnerUniverse.covered === houseOwnerUniverse.total
      && JSON.stringify(houseOwnerUniverse.members)
        === JSON.stringify(report.purity.expectedHouseOwnerMembers)
      && JSON.stringify(houseOwnerUniverse.coveredMembers)
        === JSON.stringify(houseOwnerUniverse.members)
      && houseOwnerBatches.length > 0
      && report.purity.residency.ownerFullFrames === houseOwnerBatches.length
      && houseOwnerBatches.every((entry) => entry.physicalReady === true
        && entry.ownerPreloadObjects > 0
        && entry.ownerPreloadGeometries <= 16
        && entry.geometryDelta <= 16),
    'house mirror universe is complete and uploads only after the exact physical room is playable', {
      universe: houseOwnerUniverse,
      expected: report.purity.expectedHouseOwnerMembers,
      batches: houseOwnerBatches,
    });
  check(JSON.stringify(report.purity.beforeSkullResidency)
      === JSON.stringify(report.purity.afterSkullResidency),
    'hidden WORLD/P16 skull and tether certification restores every live parent, layer, visibility, culling, and opacity field', {
      before: report.purity.beforeSkullResidency,
      after: report.purity.afterSkullResidency,
    });
  const movingResidency = report.continuousView;
  const movementIsBounded = (movement) => movement?.movements > 0
    && movement.after > movement.before
    && movement.lastMoveToFullMs != null && movement.lastMoveToFullMs <= 150
    && movement.firstFull?.drawCalls > 0 && movement.firstFull?.reducedDetail === false
    && movement.firstFull?.visibleProgramDelta === 0
    && movement.firstFull?.visibleTextureDelta === 0
    && movement.firstFull?.visibleGeometryDelta === 0
    && movement.firstFull?.ms <= 100
    && movement.frames?.some((frame) => frame.reducedDetail)
    && movement.frames.filter((frame) => frame.reducedDetail)
      .every((frame) => frame.drawCalls > 0 && frame.ms <= 100);
  check(movementIsBounded(movingResidency?.critical)
      && movementIsBounded(movingResidency?.owner)
      && movingResidency?.critical?.firstFull?.ownerQueue > 0,
    'continuous camera input promotes newly visible critical and owner geometry, keeps a nonzero silhouette moving, and returns to zero-upload full rendering within 150ms of the last look', {
      critical: movingResidency?.critical,
      owner: movingResidency?.owner,
    });
  check(movingResidency?.reducedPasses?.length > 0
      && movingResidency.reducedPasses.every((entry) => entry.error == null
        && entry.objects > 0 && entry.objects <= 32
        && entry.geometries >= 0 && entry.geometries <= 16
        && entry.geometryDelta >= 0 && entry.geometryDelta <= 16
        && entry.durationMs <= 100)
      && movingResidency?.exactPasses?.length >= 2
      && movingResidency.exactPasses.every((entry) => entry.error == null
        && entry.programDelta === 0 && entry.textureDelta === 0
        && entry.geometryDelta === 0 && entry.durationMs <= 100)
      && movingResidency.maxRafMs <= 100 && movingResidency.maxRenderMs <= 100
      && movingResidency.errors?.length === 0,
    'moving-view residency preserves the <=16 actual-geometry paint budget and every repeated exact certification is zero-delta/sub-100ms', movingResidency);
  const coldStarts = movingResidency?.coldProbeStart || {};
  const coldEnds = movingResidency?.coldProbeEnd || {};
  check(coldStarts.critical?.inOwnerQueue === true
      && coldStarts.owner?.inOwnerQueue === true
      && coldStarts.ownerFailure?.inOwnerQueue === true
      && coldStarts.physicalFailure?.inCriticalQueue === true
      && coldStarts.physicalFailure?.inOwnerQueue === false
      && Object.values(coldStarts).every((probe) => probe.inUniverse === true
        && probe.geometrySeen === false)
      && Object.values(coldEnds).every((probe) => probe.processed === true
        && probe.covered === true && probe.geometrySeen === true)
      && movingResidency.reducedPasses.some((entry) =>
        entry.ownerPreloadGeometries > 0 && entry.geometryDelta > 0
        && entry.geometryDelta <= 16),
    'continuous-look promotion proves genuinely cold unique owner geometry is uploaded in a bounded reduced batch before exact reveal', {
      start: coldStarts,
      end: coldEnds,
      passes: movingResidency?.reducedPasses,
    });
  check(movingResidency?.cloneFailureHits?.physical === 1
      && movingResidency?.cloneFailureHits?.owner === 1
      && movingResidency?.cloneFailureEvents?.length === 2
      && movingResidency.cloneFailureEvents.every((event) => event.attempt === 1
        && event.permanent === false)
      && movingResidency.ownerProgressFrames?.length > 0
      && movingResidency.ownerProgressFrames.every((frame) => frame.ownerPassDelta === 0)
      && movingResidency.ownerProgressFrames.at(-1)?.ownerQueue === 0
      && movingResidency.ownerCertificationFrames?.length === 1
      && movingResidency.ownerCertificationFrames[0].ownerProgress === false
      && movingResidency.ownerCertificationFrames[0].atMs
        > movingResidency.ownerProgressFrames.at(-1).atMs,
    'transient physical and owner clone failures retry without an infinite reduced loop, incomplete coverage, or same-paint pane certification', {
      hits: movingResidency?.cloneFailureHits,
      events: movingResidency?.cloneFailureEvents,
      criticalFrames: movingResidency?.critical?.frames,
      ownerFrames: movingResidency?.owner?.frames,
      allOwnerProgressFrames: movingResidency?.ownerProgressFrames,
      ownerCertificationFrames: movingResidency?.ownerCertificationFrames,
    });
  const persistentOwnerFailure = movingResidency?.persistentOwnerFailure;
  check(persistentOwnerFailure?.attempts?.length === 3
      && persistentOwnerFailure.attempts[0].deferred === true
      && persistentOwnerFailure.attempts[1].deferred === true
      && persistentOwnerFailure.attempts[2].failed === true
      && persistentOwnerFailure.attempts[2].permanent === true
      && persistentOwnerFailure.queue === 0
      && persistentOwnerFailure.failedObjects.length === 0
      && persistentOwnerFailure.failedOwners.length === 1
      && persistentOwnerFailure.covered < persistentOwnerFailure.total
      && persistentOwnerFailure.ownerRecorded === false
      && persistentOwnerFailure.recordReturned === false
      && persistentOwnerFailure.prerequisites === false
      && persistentOwnerFailure.physicalStillReady === true,
    'a persistent hidden owner clone fault stops after three bounded attempts, leaves the physical room playable, and keeps only the incomplete pane fail-closed',
    persistentOwnerFailure);
  check(movingResidency?.universe?.covered === movingResidency?.universe?.total
      && JSON.stringify(movingResidency?.universe?.members)
        === JSON.stringify(movingResidency?.expectedOwnerMembers)
      && JSON.stringify(movingResidency?.universe?.coveredMembers)
        === JSON.stringify(movingResidency?.universe?.members)
      && movingResidency.universe.criticalPromotedObjects > 0
      && movingResidency.universe.ownerPromotedObjects > 0,
    'promoting owner members never loses or duplicates the complete house reflection universe', {
      universe: movingResidency?.universe,
      expected: movingResidency?.expectedOwnerMembers,
    });
  check(movingResidency?.promotionChecksAtCompletion
      === movingResidency?.promotionChecksAfterSteady
      && movingResidency?.steadyFrames?.length === 8
      && movingResidency.steadyFrames.every((frame) => frame?.drawCalls > 0
        && frame.reducedDetail === false && frame.ms <= 100),
    'owner visibility promotion stops scanning after its bounded queue completes', {
      before: movingResidency?.promotionChecksAtCompletion,
      after: movingResidency?.promotionChecksAfterSteady,
      frames: movingResidency?.steadyFrames,
    });
  check(movingResidency?.sweepFrames?.length === 4
      && movingResidency.sweepFrames.every((frame) => frame?.drawCalls > 0
        && frame.reducedDetail === false
        && frame.visibleProgramDelta === 0 && frame.visibleTextureDelta === 0
        && frame.ms <= 100)
      && movingResidency.sweepMaxRafMs <= 100,
    'four post-exact 90-degree house lookbacks keep full rendering sub-100ms with no new shader or texture', {
      frames: movingResidency?.sweepFrames,
      maxRafMs: movingResidency?.sweepMaxRafMs,
    });
  check(report.deferredDistricts?.length === 3
      && report.deferredDistricts.map((entry) => `${entry.act}:${entry.rootKind}`).join(',')
        === 'graveyard:forest-lookahead,forest:clearing-lookahead,cave:cave',
    'grave-to-forest overlap, forest-to-clearing overlap, and Underfalls each run an isolated deferred-district movement adversary',
    report.deferredDistricts?.map((entry) => `${entry.act}:${entry.rootKind}`));
  for (const district of report.deferredDistricts || []) {
    const batches = district.allReducedPasses || [];
    const deferredBatches = batches.filter((entry) => entry.kind === 'deferred-preload-batch');
    check(district.coldStart?.inUniverse === true
        && district.coldStart?.inDeferredQueue === true
        && district.coldStart?.processed === false
        && district.coldStart?.geometrySeen === false
        && district.coldStart?.deferredQueue > 0
        && district.coldEnd?.processed === true
        && district.coldEnd?.covered === true
        && district.coldEnd?.geometrySeen === true,
      `${district.act} turn starts with genuinely cold deferred geometry and covers it before full reveal`, {
        start: district.coldStart,
        end: district.coldEnd,
      });
    check(district.movementFrames?.length > 0
        && district.movementFrames[0]?.reducedDetail === true
        && district.movementFrames[0]?.drawCalls > 0
        && district.movementFrames.filter((frame) => frame.reducedDetail)
          .every((frame) => frame.drawCalls > 0 && frame.ms <= 100)
        && district.moveToFullMs != null && district.moveToFullMs <= 150
        && district.firstFull?.drawCalls > 0
        && district.firstFull?.reducedDetail === false
        && district.firstFull?.visibleProgramDelta === 0
        && district.firstFull?.visibleTextureDelta === 0
        && district.firstFull?.visibleGeometryDelta === 0
        && district.firstFull?.ms <= 100
        && district.queueAtFirstFull > 0,
      `${district.act} path turn promotes before reveal, keeps a moving silhouette, and returns to a zero-upload full world within 150ms`, {
        moveToFullMs: district.moveToFullMs,
        queueAtFirstFull: district.queueAtFirstFull,
        movementFrames: district.movementFrames,
      });
    check(batches.length > 0
        && batches.every((entry) => entry.error == null
          && entry.objects > 0 && entry.objects <= 32
          && entry.geometries >= 0 && entry.geometries <= 16
          && entry.geometryDelta >= 0 && entry.geometryDelta <= 16
          && entry.durationMs <= 100)
        && batches.some((entry) => entry.deferredPreloadGeometries > 0
          && entry.geometryDelta > 0)
        && district.exactPassesAtReveal?.length >= 2
        && district.exactPassesAtReveal.every((entry) => entry.error == null
          && entry.programDelta === 0 && entry.textureDelta === 0
          && entry.geometryDelta === 0 && entry.durationMs <= 100)
        && district.maxRafMs <= 100 && district.maxRenderMs <= 100
        && district.errors?.length === 0,
      `${district.act} deferred uploads and repeated exact certifications stay inside the <=16-geometry/sub-100ms D3D11 contract`, {
        batches,
        exact: district.exactPassesAtReveal,
        maxRafMs: district.maxRafMs,
        maxRenderMs: district.maxRenderMs,
        errors: district.errors,
      });
    check(district.universe?.label === district.act
        && district.universe?.total > 0
        && district.universe.covered === district.universe.total
        && JSON.stringify(district.universe.members)
          === JSON.stringify(district.expectedMembers)
        && JSON.stringify(district.universe.coveredMembers)
          === JSON.stringify(district.universe.members)
        && district.universe.promotedObjects > 0
        && district.universe.cloneFailureEvents?.length === 0
        && deferredBatches.length > 0
        && district.deferredFullFrames === deferredBatches.length,
      `${district.act} explicit authored universe drains completely behind the playable world without duplicate or missing ownership`, {
        universe: district.universe,
        expected: district.expectedMembers,
        deferredBatches,
        deferredFullFrames: district.deferredFullFrames,
      });
    check(district.promotionChecksAtCompletion
          === district.promotionChecksAfterSteady
        && district.steadyFrames?.length === 8
        && district.steadyFrames.every((frame) => frame?.drawCalls > 0
          && frame.reducedDetail === false && frame.ms <= 100),
      `${district.act} deferred visibility scanning stops permanently after its finite district queue drains`, {
        before: district.promotionChecksAtCompletion,
        after: district.promotionChecksAfterSteady,
        frames: district.steadyFrames,
      });
    check(district.sweepFrames?.length === 4
        && district.sweepFrames.every((frame) => frame?.drawCalls > 0
          && frame.reducedDetail === false
          && frame.visibleProgramDelta === 0
          && frame.visibleTextureDelta === 0
          && frame.visibleGeometryDelta === 0
          && frame.ms <= 100)
        && district.sweepMaxRafMs <= 100,
      `${district.act} four-way post-drain path lookback stays full, zero-upload, and sub-100ms`, {
        frames: district.sweepFrames,
        maxRafMs: district.sweepMaxRafMs,
      });
  }
  const deferredFault = report.deferredDistricts
    ?.find((entry) => entry.act === 'forest')?.transactionalFault;
  check(deferredFault?.afterFault?.returned == null
      && deferredFault.afterFault.queue === 1
      && deferredFault.afterFault.processed === false
      && deferredFault.afterFault.covered === false
      && deferredFault.afterFault.geometrySeen === false
      && deferredFault.afterFault.recorded === false
      && deferredFault.retry?.error == null
      && deferredFault.retry?.objects === 1
      && deferredFault.retry?.geometries === 1
      && deferredFault.afterRetry?.queue === 0
      && deferredFault.afterRetry?.processed === true
      && deferredFault.afterRetry?.covered === true
      && deferredFault.afterRetry?.geometrySeen === true
      && deferredFault.afterRetry?.recorded === true,
    'a hidden deferred render fault rolls its whole batch back transactionally, cannot certify, and commits only after a clean retry',
    deferredFault);
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
  for (const key of [
    'act', 'player', 'flags', 'enemies', 'choir', 'spawnSerial', 'spawnLog',
    'audioReady', 'audioLoops', 'forestLoops', 'audioZone',
    'skullStage', 'skullMode', 'skullParent', 'exactHead', 'headChildren',
    'figureVisible', 'finaleActive', 'finalePhase', 'contextRewarming',
    'rendererTarget', 'sceneParents',
  ]) {
    check(same(afterStart, afterWarm, key), `warmup preserves live ${key}`,
      same(afterStart, afterWarm, key) ? null : { before: afterStart[key], after: afterWarm[key] });
  }
  const warmIntervals = report.purity.intervals || [];
  check(Math.max(0, ...warmIntervals) < 100,
    'immediate-Wake sampling includes no warmup-owned frame over 100ms', {
      maxRafMs: round(Math.max(0, ...warmIntervals)),
      p95RafMs: round(percentile(warmIntervals, 0.95)),
    });

  for (const seam of report.settled) {
    const mirror = seam.name === 'cave->mirror';
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
    check(seam.maxRafMs <= (mirror ? 140 : 100),
      `${seam.name} first-entry rAF stays inside the D3D11 acceptance budget`, seam);
    check(seam.maxStepMs < 20,
      `${seam.name} fixed simulation remains below 20ms`, seam);
    check(seam.worldSubmitted === true && seam.firstWorldMs != null
        && seam.firstWorldMs <= 100 && seam.shieldFrames === 0,
      `${seam.name} settled entry submits a nonzero world within 100ms with no opaque frame`, seam);
    check(seam.sweepFrames?.length === 4
        && seam.sweepFrames.every((frame) => frame?.drawCalls > 0
          && frame.reducedDetail === false
          && frame.visibleProgramDelta === 0
          && frame.visibleTextureDelta === 0
          && frame.ms <= 100)
        && seam.sweepMaxRafMs <= 100,
      `${seam.name} four-way post-exact lookback stays sub-100ms with no cold shader or texture`, {
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

  const verbCases = Object.fromEntries((report.verbChurn?.cases || [])
    .map((entry) => [entry.label, entry]));
  for (const label of [
    'first-throw', 'catch-return', 'bedroom-key-carry',
    'flame-absorb', 'offscreen-stage-evolution',
  ]) {
    const entry = verbCases[label];
    check(entry?.exactAfter === entry?.exactBefore
        && entry?.maxRafMs <= 100 && entry?.maxRenderMs <= 100,
      `${label} never recertifies the full scene during visible play and stays inside 100ms`, entry);
  }
  for (const label of ['first-throw', 'catch-return', 'bedroom-key-carry', 'flame-absorb']) {
    const entry = verbCases[label];
    check(entry?.maxVisibleProgramDelta === 0
        && entry?.maxVisibleTextureDelta === 0
        && entry?.maxVisibleGeometryDelta === 0,
      `${label} consumes only its prebuilt held/carry resource path`, entry);
  }
  const mirrorApproach = verbCases['awakened-mirror-approach'];
  check(mirrorApproach?.exactAfter === mirrorApproach?.exactBefore
      && mirrorApproach?.ownerAfter === mirrorApproach?.ownerBefore + 1
      && mirrorApproach?.ownerPasses?.length === 1
      && mirrorApproach.ownerPasses[0].rendered === true
      && mirrorApproach.ownerPasses[0].error == null
      && mirrorApproach.ownerPasses[0].durationMs <= 100
      && mirrorApproach.ownerPasses[0].programDelta === 0
      && mirrorApproach.ownerPasses[0].textureDelta === 0
      && mirrorApproach.ownerPasses[0].geometryDelta === 0
      && mirrorApproach.firstFrame?.paneActive === false
      && mirrorApproach.firstPaneFrame?.programDelta === 0
      && mirrorApproach.firstPaneFrame?.textureDelta === 0
      && mirrorApproach.firstPaneFrame?.geometryDelta === 0
      && mirrorApproach.maxRafMs <= 100 && mirrorApproach.maxRenderMs <= 100,
    'awakened house mirror certifies once behind dark glass under 100ms, then enables with zero upload',
    mirrorApproach);
  check(exactP16LightCensus(mirrorApproach?.reflectionLightCensus),
    'actual house reflection camera receives exact A1/H1/D1/S1/P16 with one directional shadow',
    mirrorApproach?.reflectionLightCensus);
  const mirrorMotion = verbCases['awakened-mirror-motion'];
  check(mirrorMotion?.exactAfter === mirrorMotion?.exactBefore
      && mirrorMotion?.ownerAfter === mirrorMotion?.ownerBefore
      && mirrorMotion?.ownerPasses?.length === 0
      && mirrorMotion?.firstPaneFrame?.programDelta === 0
      && mirrorMotion?.firstPaneFrame?.textureDelta === 0
      && mirrorMotion?.firstPaneFrame?.geometryDelta === 0
      && mirrorMotion?.maxVisibleProgramDelta === 0
      && mirrorMotion?.maxVisibleTextureDelta === 0
      && mirrorMotion?.maxVisibleGeometryDelta === 0
      && mirrorMotion?.maxRafMs <= 100 && mirrorMotion?.maxRenderMs <= 100,
    'later house mirror-camera motion reveals only the completed owner universe without recertification or upload',
    mirrorMotion);
  check(exactP16LightCensus(mirrorMotion?.reflectionLightCensus),
    'moved live house reflection camera retains the exact fixed light/shadow signature',
    mirrorMotion?.reflectionLightCensus);
  check(report.verbChurn?.residencyErrors?.length === 0,
    'normal visible verb and mirror-approach residency emits zero certification errors',
    report.verbChurn?.residencyErrors);

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
  check(report.race.wakeHouse?.wakeToFirstFullMs != null
      && report.race.wakeHouse.wakeToFirstFullMs <= 600
      && report.race.wakeHouse.firstFull?.visibleProgramDelta === 0
      && report.race.wakeHouse.firstFull?.visibleTextureDelta === 0
      && report.race.wakeHouse.firstFull?.visibleGeometryDelta === 0
      && report.race.wakeHouse.firstFull?.ms <= 100,
    'immediate Wake reaches the exact full house within 600ms with a zero-upload sub-100ms reveal',
    report.race.wakeHouse);
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
  check(report.race.maxRafMs <= 100,
    'the complete immediate-Wake/fast-entry race contains no multi-second freeze', {
      maxRafMs: report.race.maxRafMs,
      p95RafMs: report.race.p95RafMs,
      maxRenderMs: report.race.maxRenderMs,
    });
  check(report.race.residency?.maxReducedPrimeMs <= 100
      && report.race.residency?.maxExactMs <= 100
      && report.race.residency?.maxOwnerMs <= 140
      && report.race.residency?.errors?.length === 0,
    'exact live-scene, reduced fallback, and owner-RT certifications remain inside their hard budgets',
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
      && report.race.firstImpact.before.ringUuid === report.race.firstImpact.after.ringUuid,
    'first locked/bell impact reuses its boot-resident light and ring without scene allocation',
    report.race.firstImpact);
  check(report.race.firstImpact.visibleRenderProgramDelta === 0
      && report.race.firstImpact.visibleRenderTextureDelta === 0
      && report.race.firstImpact.visibleRenderGeometryDelta === 0,
    'first locked/bell impact compiles and allocates zero visible-frame resources',
    report.race.firstImpact);
  check(report.race.firstImpact.maxRafMs <= 100
      && report.race.firstImpact.maxRenderMs < 70,
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
          entry.geometryDelta >= 0 && entry.geometryDelta <= 16 && entry.durationMs <= 100)
        && outboundResidency?.exactPasses?.length > 0
        && outboundResidency.exactPasses.every((entry) => entry.programDelta === 0
          && entry.textureDelta === 0 && entry.geometryDelta === 0 && entry.durationMs <= 100)
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
      check(probe?.maxRafMs <= 100 && probe?.maxRenderMs <= 100
          && probe?.exactPass?.durationMs <= 100,
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
      check(seam.maxRafMs <= (seam.act === 'mirror' ? 140 : 100),
        `restored-context ${seam.act} entry stays inside the cold-frame budget`, seam);
      check(seam.worldSubmitted === true && seam.shielded === false,
        `restored-context ${seam.act} delivers a nonzero world instead of an opaque pass`, seam);
    }
    const recoveredHouseFrame = recovery.firstRecoveredHouseFrame;
    const recoveredHouseFull = recovery.firstRecoveredHouseFullFrame;
    const recoveredHouseTypes = recoveredHouseFull?.lightTypes;
    check(recoveredHouseFrame?.worldDrawCalls > 0
        && recoveredHouseFrame?.visibleProgramDelta === 0
        && recoveredHouseFrame?.visibleTextureDelta === 0
        && recoveredHouseFrame?.visibleGeometryDelta === 0
        && recoveredHouseFrame?.ms <= 100,
      'first restored house frame is a bounded nonzero playable submission with zero visible upload',
      recoveredHouseFrame);
    check(recoveredHouseFull?.worldDrawCalls > 0
        && recoveredHouseFull?.heldDrawCalls > 0
        && recoveredHouseFull?.reducedDetail === false
        && recoveredHouseFull?.visibleProgramDelta === 0
        && recoveredHouseFull?.visibleTextureDelta === 0
        && recoveredHouseFull?.visibleGeometryDelta === 0
        && recoveredHouseFull?.ms <= 100,
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
    for (const view of recovery.restoredHouseViews || []) {
      check(view.maxVisibleProgramDelta === 0
          && view.maxVisibleTextureDelta === 0
          && view.maxVisibleGeometryDelta === 0
          && view.maxRafMs <= (view.kind.includes('mirror') ? 140 : 100),
        `restored house ${view.kind} reveals no cold program/texture/geometry upload`, view);
      if (view.kind.includes('mirror')) {
        check(exactP16LightCensus(view.reflectionLightCensus),
          `restored house ${view.kind} actual reflection camera uses exact A1/H1/D1/S1/P16`,
          view.reflectionLightCensus);
      }
      if (view.kind === 'mirror') {
        check(view.mirrorActive === true && view.paneActive === true
            && view.targetState?.status === 'ready'
            && view.targetState.generation === byLabel['ready-after-pending-loss']?.generation,
          'restored awakened house mirror consumes only its current resident target', view);
        check(view.ownerPasses.length === 1
            && view.ownerPasses[0].rendered === true
            && view.ownerPasses[0].error == null
            && view.ownerPasses[0].durationMs <= 140
            && view.ownerPasses[0].programDelta === 0
            && view.ownerPasses[0].textureDelta === 0
            && view.ownerPasses[0].geometryDelta === 0
            && view.firstEnabledFrame?.programDelta === 0
            && view.firstEnabledFrame?.textureDelta === 0
            && view.firstEnabledFrame?.geometryDelta === 0,
          'house pane certifies its actual owner RT in one bounded hidden pass before first enable', view);
      } else if (view.kind === 'mirror-motion') {
        check(view.ownerPasses.length === 0
            && view.mirrorActive === true && view.paneActive === true
            && view.firstEnabledFrame?.programDelta === 0
            && view.firstEnabledFrame?.textureDelta === 0
            && view.firstEnabledFrame?.geometryDelta === 0,
          'later restored house mirror motion consumes the completed owner universe without recertification',
          view);
      }
    }
    const restoredHouseUniverse = recovery.restoredHouseOwnerUniverses
      ?.find((entry) => entry.house > 0);
    check(restoredHouseUniverse?.covered === restoredHouseUniverse?.total
        && restoredHouseUniverse?.houseGeometries > 0
        && JSON.stringify(restoredHouseUniverse?.members)
          === JSON.stringify(recovery.expectedHouseOwnerMembers)
        && JSON.stringify(restoredHouseUniverse?.coveredMembers)
          === JSON.stringify(restoredHouseUniverse?.members)
        && (recovery.restoredHouseOwnerBatches || []).length > 0
        && recovery.restoredHouseOwnerBatches.every((entry) =>
          entry.physicalReady === true && entry.ownerPreloadObjects > 0
          && entry.ownerPreloadGeometries <= 16 && entry.geometryDelta <= 16
          && entry.durationMs <= 100),
      'restored house owner universe covers every possible authored pane renderable after physical reveal', {
        universe: restoredHouseUniverse,
        expected: recovery.expectedHouseOwnerMembers,
        batches: recovery.restoredHouseOwnerBatches,
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
        && recovery.restoredImpact?.maxRafMs <= 100,
      'first post-restore impact reuses its physically delivered ring/light with zero resource delta',
      recovery.restoredImpact);
    const pools = recovery.dynamicPoolActivation;
    check(pools?.before.goreCount === 0 && pools?.before.stainCount === 0
        && pools?.after.goreCount === 1 && pools?.after.stainCount === 1
        && pools.maxRafMs <= 100,
      'later offscreen gore and enemy-stain pool activation remains below the ordinary-frame budget',
      pools);
    const firstReflection = recovery.firstRestoredReflection;
    check(firstReflection?.afterPrograms === firstReflection?.beforePrograms
        && firstReflection?.afterTextures === firstReflection?.beforeTextures
        && firstReflection?.afterGeometries === firstReflection?.beforeGeometries,
      'first active-Finale reflection after restore compiles and allocates zero resources',
      firstReflection);
    check(firstReflection?.ms <= 140 && recovery.activeRestoreMaxRafMs <= 140,
      'active-Finale restore and first reflection remain within the mirror frame budget', {
        firstReflection,
        activeRestoreMaxRafMs: recovery.activeRestoreMaxRafMs,
      });
    check(exactP16LightCensus(recovery.finaleReflectionLightCensus),
      'actual active-Finale reflection camera receives exact A1/H1/D1/S1/P16 with one directional shadow',
      recovery.finaleReflectionLightCensus);
    check(recovery.finaleOwnerPasses?.length === 1
        && recovery.finaleOwnerPasses[0].rendered === true
        && recovery.finaleOwnerPasses[0].error == null
        && recovery.finaleOwnerPasses[0].durationMs <= 140
        && recovery.finaleOwnerPasses[0].programDelta === 0
        && recovery.finaleOwnerPasses[0].textureDelta === 0
        && recovery.finaleOwnerPasses[0].geometryDelta === 0,
      'Finale owner RT is certified once in a bounded hidden pass before glass is enabled',
      recovery.finaleOwnerPasses);
    const finaleUniverse = recovery.finaleOwnerUniverses
      ?.find((entry) => entry.finale > 0);
    check(finaleUniverse?.covered === finaleUniverse?.total
        && finaleUniverse?.finaleGeometries > 0
        && JSON.stringify(finaleUniverse?.members)
          === JSON.stringify(recovery.expectedFinaleOwnerMembers)
        && JSON.stringify(finaleUniverse?.coveredMembers)
          === JSON.stringify(finaleUniverse?.members)
        && (recovery.finaleOwnerBatches || []).length > 0
        && recovery.finaleOwnerBatches.every((entry) =>
          entry.physicalReady === true && entry.ownerPreloadObjects > 0
          && entry.ownerPreloadGeometries <= 16 && entry.geometryDelta <= 16
          && entry.durationMs <= 100),
      'Finale owner universe covers every possible room/figure/head pane renderable after physical reveal', {
        universe: finaleUniverse,
        expected: recovery.expectedFinaleOwnerMembers,
        batches: recovery.finaleOwnerBatches,
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
          && frame.ms <= 140)
        && finaleMotion.maxRafMs <= 140,
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
        && houseFailures.bindFailed.drawCalls > 0
        && houseFailures.bindFailed.paneActive === false
        && houseFailures.bindFailed.shielded === false,
      'persistent house-target bind failure retries twice while world stays live and pane stays dark',
      houseFailures);
    check(houseFailures.bindRecovered.shaderStatus === 'ready'
        && houseFailures.bindRecovered.generation === houseFailures.bindFailed.generation
        && houseFailures.bindRecovered.target?.status === 'ready'
        && houseFailures.bindRecovered.target.warmed === 1
        && houseFailures.bindRecovered.mirrorActive === true
        && houseFailures.bindRecovered.paneActive === true
        && houseFailures.bindRecovered.visibleProgramDelta === 0
        && houseFailures.bindRecovered.visibleTextureDelta === 0
        && houseFailures.bindRecovered.visibleGeometryDelta === 0,
      'bounded same-generation retry certifies the hidden owner target before a zero-upload visible pane',
      houseFailures.bindRecovered);
    check(houseFailures.reflectionCompileFailures > 0
        && houseFailures.reflectionFailed.shaderStatus === 'degraded'
        && houseFailures.reflectionFailed.target?.status === 'ready'
        && !houseFailures.reflectionFailed.readyVariants.includes('house-reflection')
        && houseFailures.reflectionFailed.drawCalls > 0
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
        && houseFailures.houseRuntimeFailed.drawCalls > 0
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
        && houseFailures.houseRuntimeRecovered.drawCalls > 0,
      'the live house-pane fault automatically recovers in the same GL generation',
      houseFailures.houseRuntimeRecovered);
    check(houseFailures.finaleRuntimeFaults === 1
        && houseFailures.finaleRuntimeFailed.escaped === null
        && houseFailures.finaleRuntimeFailed.poolInUpdate === false
        && houseFailures.finaleRuntimeFailed.scopesVisible.every((visible) => visible === true)
        && houseFailures.finaleRuntimeFailed.panesActive.every((active) => active === false)
        && houseFailures.finaleRuntimeFailed.contextRewarming === true
        && houseFailures.finaleRuntimeFailed.drawCalls > 0
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
        && houseFailures.finaleRuntimeRecovered.drawCalls > 0,
      'the live Finale target fault automatically recovers in the same GL generation',
      houseFailures.finaleRuntimeRecovered);
  }
  for (const seam of report.race.transitions) {
    const mirror = seam.name === 'cave->mirror';
    check(seam.visibleRenderProgramDelta === 0
        && seam.visibleRenderTextureDelta === 0
        && seam.visibleRenderGeometryDelta === 0,
      `${seam.name} race reveals no cold program, texture, or geometry upload`, seam);
    check(seam.maxRafMs <= 100,
      `${seam.name} race rAF stays inside the cold-entry budget`, seam);
    check(seam.maxRenderMs <= (mirror ? 140 : 100),
      `${seam.name} race render submission stays bounded`, seam);
    check(seam.worldSubmitted === true && seam.firstWorldMs != null
        && seam.firstWorldMs <= 150 && seam.shieldDurationMs === 0
        && seam.shieldFrames === 0,
      `${seam.name} impossible-fast entry reveals a nonzero moving world within 150ms without a shield`, seam);
  }
  check(report.race.residentReturn?.residentBefore === true
      && report.race.residentReturn.restarts === 0
      && report.race.residentReturn.worldSubmitted === true
      && report.race.residentReturn.firstWorldMs <= 100
      && report.race.residentReturn.visibleProgramDelta === 0
      && report.race.residentReturn.visibleTextureDelta === 0
      && report.race.residentReturn.visibleGeometryDelta === 0
      && report.race.residentReturn.maxRafMs <= 100,
    'a reprioritized forest remains genuinely resident when the player returns',
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

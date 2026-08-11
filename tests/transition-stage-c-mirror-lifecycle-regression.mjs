// Focused Stage C D3D11 mirror-pool lifecycle and live-fault recovery gate.
//
// One page exercises same-generation House/Finale target replacement, every
// required Mirrors bind/render/restore failure phases across the two production
// recovery paths,
// and a real Finale -> House lifecycle exit. Expected injected failures remain
// isolated from ordinary C1/C2 evidence.
import { writeFileSync } from 'node:fs';
import {
  ensureServer, launchBrowser, openPage, PORT, URL_BASE, resultsPath,
} from './lib/harness.mjs';

const URL = `${URL_BASE}/?test=1&mute=1&warmup=1&warmupRace=1&gpuidentity=1`;
const failures = [];
const report = {
  url: URL,
  port: PORT,
  scope: 'stage-c-live-mirror-pool-lifecycle',
  renderer: null,
  webgl2: null,
  generation: null,
  setupOperations: [],
  baseline: null,
  replacements: {},
  faults: {},
  leave: null,
  episodes: {},
  trace: null,
  browserErrors: [],
  failures,
};
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};
const requiredVariants = (kind) => kind === 'house'
  ? ['house-reflection', 'house-mirror-target']
  : ['finale-world', 'reflection-target'];
const liveGlPhases = [
  'visible-render',
  'house-pane-render', 'finale-pane-render',
  'world-visible', 'held-visible', 'grain-visible',
];
const coldPreloadPhases = [
  'reduced-preload', 'current-exact-preload',
  'owner-reduced-preload', 'owner-exact-preload',
  'deferred-reduced-preload', 'deferred-exact-preload',
];
const emptyGl = () => ({
  bindBuffer: 0, bufferData: 0, bufferDataBytes: 0,
  bufferSubData: 0, bufferSubDataBytes: 0, unallocatedBufferSubData: 0,
  bufferAllocationProbeErrors: 0, createVertexArray: 0, bindVertexArray: 0,
  samples: [], vaoSamples: [],
});
const sumGl = (phases, names = Object.keys(phases || {})) => {
  const total = emptyGl();
  for (const name of names) {
    const source = phases?.[name];
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) total[key].push(...value);
      else total[key] += value || 0;
    }
  }
  return total;
};

function validateEpisode(label, episode, { owner = true, coldFree = true } = {}) {
  check(episode != null, `${label} capture exists`, episode);
  if (!episode) return;
  check(episode.generation === report.generation,
    `${label} stays in the original WebGL generation`, episode.generation);
  check(episode.frames > 0 && episode.maxRenderMs < 100
      && episode.slowFrames.length === 0,
  `${label} keeps every render strictly below 100ms`, episode);
  check(episode.rafIntervals > 0 && episode.maxRafMs < 100
      && episode.slowRafs.length === 0
      && episode.stageToFirstObservedRafMs < 100,
  `${label} keeps every owned rAF boundary strictly below 100ms`, episode);
  check(episode.shieldedFrames === 0 && episode.visibleResourceFrames.length === 0,
    `${label} reveals no shader shield or visible cold P/T/G work`, episode);
  const liveGl = sumGl(episode.glByPhase, liveGlPhases);
  check(liveGl.bufferData === 0 && liveGl.createVertexArray === 0
      && liveGl.unallocatedBufferSubData === 0
      && liveGl.bufferAllocationProbeErrors === 0,
  `${label} performs no cold work in a live pane/world/held/grain consumer`, liveGl);
  check(episode.gl.unallocatedBufferSubData === 0
      && episode.gl.bufferAllocationProbeErrors === 0,
  `${label} attributes every hidden mutation to allocated storage`, episode.gl);
  const coldPhases = Object.entries(episode.glByPhase || {})
    .filter(([, counts]) => counts.bufferData > 0 || counts.createVertexArray > 0)
    .map(([name, counts]) => ({ name, counts }));
  check(coldPhases.every(({ name }) => coldPreloadPhases.includes(name)),
    `${label} confines every permitted cold operation to a named preload transaction`,
    coldPhases);
  check(coldPhases.length === 0 || episode.preloadPasses.length > 0,
    `${label} backs every permitted cold phase with source transaction telemetry`,
    { coldPhases, preloadPasses: episode.preloadPasses });
  check(episode.preloadPasses.every((entry) => entry.error == null
      && entry.durationMs < 100 && entry.programDelta === 0 && entry.textureDelta === 0
      && entry.committed === true && entry.stateRestored === true
      && entry.generationStable === true && entry.fingerprintsStable === true
      && entry.queuePrefixStable === true),
  `${label} keeps every hidden preload bounded, transactional, and program-stable`,
  episode.preloadPasses);
  if (coldFree) {
    const hidden = sumGl(episode.glByPhase,
      Object.keys(episode.glByPhase || {}).filter((name) => !liveGlPhases.includes(name)));
    check(hidden.bufferData === 0 && hidden.createVertexArray === 0,
      `${label} needs no additional hidden residency work`, hidden);
  }
  if (!owner) return;
  check(episode.ownerPasses.length === 1,
    `${label} earns exactly one new owner certificate`, episode.ownerPasses);
  const pass = episode.ownerPasses[0];
  check(pass?.kind === episode.kind && pass?.rendered === true && pass?.error == null
      && pass?.durationMs < 100 && pass?.programDelta === 0
      && pass?.textureDelta === 0 && pass?.geometryDelta === 0,
  `${label} owner certificate is clean, zero-allocation, and strictly sub-100ms`, pass);
  const lights = pass?.identity?.programIdentity?.lights;
  check(pass?.identity?.programIdentity?.count === 0
      && lights?.total === 20 && lights?.directionalShadows === 1
      && lights?.byType?.AmbientLight === 1
      && lights?.byType?.HemisphereLight === 1
      && lights?.byType?.DirectionalLight === 1
      && lights?.byType?.SpotLight === 1
      && lights?.byType?.PointLight === 16,
  `${label} owner certificate consumes the exact shipping A1/H1/D1/S1/P16 rig`,
  pass?.identity);
  const ownerPhase = episode.ownerFrame?.glByPhase?.[`${episode.kind}-owner-certificate`];
  const paneLive = sumGl(episode.firstPaneFrame?.glByPhase, liveGlPhases);
  const panePhase = episode.firstPaneFrame?.glByPhase?.[`${episode.kind}-pane-render`];
  const paneTextures = episode.kind === 'house'
    ? [episode.firstPaneFrame?.houseTextureUuid].filter(Boolean)
    : episode.firstPaneFrame?.finaleTextureUuids || [];
  const poolTextures = episode.kind === 'house'
    ? episode.firstPaneFrame?.housePoolTextureUuids || []
    : episode.firstPaneFrame?.finalePoolTextureUuids || [];
  check(episode.ownerFrameId != null && episode.firstPaneFrameId != null
      && episode.firstPaneFrameId > episode.ownerFrameId
      && ownerPhase?.bufferData === 0
      && ownerPhase?.createVertexArray === 0
      && panePhase != null && paneTextures.length > 0
      && paneTextures.every((uuid) => poolTextures.includes(uuid))
      && episode.firstPaneFrame?.worldDrawCalls > 0
      && episode.firstPaneFrame?.visibleProgramDelta === 0
      && episode.firstPaneFrame?.visibleTextureDelta === 0
      && episode.firstPaneFrame?.visibleGeometryDelta === 0
      && paneLive.bufferData === 0
      && paneLive.createVertexArray === 0,
  `${label} separates hidden owner certification from a zero-cold pane reveal`, {
    ownerFrame: episode.ownerFrame,
    firstPaneFrame: episode.firstPaneFrame,
  });
}

function validateReady(label, ready, kind) {
  check(ready?.ownerPresent === true && ready?.ownerKey === ready?.ownerPassKey,
    `${label} owns the exact live pool key`, ready);
  check(ready?.residencyErrors?.length === 0,
    `${label} records zero residency errors`, ready?.residencyErrors);
  check(ready?.target?.status === 'ready' && ready.target.generation === report.generation
      && ready.target.poolRefMatches && ready.target.targetRefsMatch
      && ready.target.poolSignatureMatches && ready.target.failedTargets.length === 0
      && ready.target.errors.length === 0
      && Number.isFinite(ready.target.maxSliceMs) && ready.target.maxSliceMs < 100,
  `${label} target pool is current, clean, and bounded`, ready?.target);
  check(ready?.shader?.status === 'ready'
      && ready.shader.generation === report.generation
      && ready.shader.compileJobsInFlight === 0 && ready.shader.pendingTextures === 0
      && ready.shader.errors.length === 0
      && requiredVariants(kind).every((name) => ready.shader.readyVariants.includes(name))
      && ready.shader.operations.every((entry) => entry.error == null
        && entry.invalidated !== true && entry.maxSynchronousSliceMs < 100),
  `${label} shader recovery is quiescent with only bounded synchronous slices`, ready?.shader);
  check(ready?.pane.activeCount > 0 && ready.pane.textureUuids.length > 0
      && ready.pane.textureUuids.every((uuid) => ready.pool.textureUuids.includes(uuid)),
  `${label} panes sample only the current certified pool`, ready?.pane);
}

function validateReplacement(label, row, kind) {
  check(row?.action?.error == null && row?.action?.durationMs < 100,
    `${label} replacement callback is strictly sub-100ms`, row?.action);
  check(row?.immediate?.generationUnchanged === true
      && row.immediate.poolEpochAdvancedOnce === true
      && row.immediate.poolRefChanged === true
      && row.immediate.targetsAllChanged === true
      && row.immediate.textureUuidsDisjoint === true
      && row.immediate.oldTargetsDisposedOnce === true,
  `${label} replaces and disposes exactly one complete pool epoch`, row?.immediate);
  check(row?.immediate?.oldOwnerRetired === true
      && row.immediate.panesDark === true
      && row.immediate.labelsRetired === true
      && row.immediate.poolChangeRows === 1,
  `${label} retires stale owner/labels and fails every pane dark synchronously`, row?.immediate);
  check(row?.recovered?.generationUnchanged === true
      && row.recovered.ownerKeyChanged === true
      && row.recovered.oldUuidRebindings.length === 0,
  `${label} recertifies only the new same-generation target identity`, row?.recovered);
  validateReady(`${label} recovered`, row?.recovered?.ready, kind);
  validateEpisode(`${label} episode`, report.episodes[row?.episode], { owner: true });
}

function validateFault(label, row, kind, expectedPhase) {
  check(row?.fired === true && row?.escaped == null && row?.methodRestored === true
      && row?.failureSerialDelta === 1 && row?.failure?.phase === expectedPhase
      && row?.failure?.message?.includes('injected'),
  `${label} fires once, is contained, and reports its exact operation`, row);
  check(row?.containment?.rendererTargetRestored === true
      && row.containment.framebufferRestored === true
      && row.containment.viewportRestored === true
      && row.containment.scissorRestored === true
      && row.containment.scissorTestRestored === true
      && row.containment.autoClearRestored === true
      && row.containment.cameraMaskRestored === true
      && row.containment.scopeVisibilityRestored === true,
  `${label} restores the complete nested renderer transaction`, row?.containment);
  check(row?.immediate?.generationUnchanged === true
      && row.immediate.poolIdentityUnchanged === true
      && row.immediate.ownerRetired === true && row.immediate.panesDark === true
      && row.immediate.recoveryInvalidated === true,
  `${label} fails closed without replacing its pool or generation`, row?.immediate);
  check(row?.recovered?.generationUnchanged === true
      && row.recovered.poolIdentityUnchanged === true
      && row.recovered.ownerKeyUnchanged === true,
  `${label} automatically re-earns the same live owner identity`, row?.recovered);
  validateReady(`${label} recovered`, row?.recovered?.ready, kind);
  validateEpisode(`${label} episode`, report.episodes[row?.episode], { owner: true });
}

let server = null;
let browser = null;
let opened = null;
try {
  server = await ensureServer();
  browser = await launchBrowser();
  opened = await openPage(browser, URL, { width: 1280, height: 720 });
  const { page } = opened;
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.renderer,
    null, { timeout: 90000, polling: 50 });

  const result = await page.evaluate(async () => {
    const g = window.__game;
    const F = window.__FETCH;
    const renderer = g.renderer;
    const gl = renderer.getContext();
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const pageVariants = (kind) => kind === 'house'
      ? ['house-reflection', 'house-mirror-target']
      : ['finale-world', 'reflection-target'];
    const pageRetiredVariants = (kind) => kind === 'house'
      ? ['house-reflection', 'house-mirror-target'] : ['reflection-target'];
    const stats = () => ({
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    });
    const makeGl = () => ({
      bindBuffer: 0, bufferData: 0, bufferDataBytes: 0,
      bufferSubData: 0, bufferSubDataBytes: 0, unallocatedBufferSubData: 0,
      bufferAllocationProbeErrors: 0, createVertexArray: 0, bindVertexArray: 0,
      samples: [], vaoSamples: [],
    });
    const addGl = (target, source) => {
      for (const [key, value] of Object.entries(source || {})) {
        if (Array.isArray(value)) {
          target[key] ||= [];
          target[key].push(...value);
          if (target[key].length > 192) target[key].splice(0, target[key].length - 192);
        } else target[key] += value || 0;
      }
    };
    const sameArray = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    const poolFor = (kind) => kind === 'house'
      ? g.houseMirror.pool : g.finale.mirrors;
    const panesFor = (kind) => kind === 'house'
      ? [g.houseMirror.pane] : g.finale.panes;
    const paneState = (kind) => {
      const panes = panesFor(kind);
      return {
        activeCount: panes.filter((pane) => pane.active).length,
        textureUuids: panes.map((pane) =>
          pane.material.uniforms.tDiffuse.value?.uuid || null).filter(Boolean),
        meshVisibility: panes.map((pane) => pane.mesh.visible),
        allDark: panes.every((pane) => !pane.active
          && pane.material.uniforms.tDiffuse.value == null),
        doubleHidden: kind !== 'house' || (g.houseMirror.double.visible === false
          && g.houseMirror.echo.visible === false),
      };
    };
    const capturePool = (kind) => {
      const owner = poolFor(kind);
      return {
        generation: g._webglGeneration,
        owner,
        pool: owner.pool,
        targets: [...owner.pool],
        textureUuids: owner.pool.map((target) => target.texture?.uuid || 'no-texture'),
        poolEpoch: owner.poolEpoch,
        size: owner.size,
        budget: owner.budget,
        signature: g._renderTargetPoolIdentity(owner.pool, owner),
        ownerKey: g._ownerGpuResidencyKey(kind),
      };
    };
    const serializePool = (pool) => ({
      poolEpoch: pool.poolEpoch, size: pool.size, budget: pool.budget,
      textureUuids: [...pool.textureUuids], signature: pool.signature,
      ownerKey: pool.ownerKey,
    });
    const targetSnapshot = (kind) => {
      const owner = poolFor(kind);
      const pool = owner.pool;
      const state = kind === 'house'
        ? g._houseMirrorTargetWarmState : g.finale._targetWarmState;
      const targetRefsMatch = kind === 'house'
        ? state?.targetRef === pool[0]
        : state?.targetRefs?.length === pool.length
          && state.targetRefs.every((target, index) => target === pool[index]);
      return {
        status: state?.status || null,
        generation: state?.generation ?? null,
        warmed: state?.warmed ?? null,
        budget: kind === 'house' ? 1 : state?.budget ?? null,
        poolLength: pool.length,
        poolRefMatches: state?.poolRef === pool,
        targetRefsMatch: !!targetRefsMatch,
        poolEpoch: state?.poolEpoch ?? null,
        livePoolEpoch: owner.poolEpoch,
        poolSignature: state?.poolSignature || null,
        livePoolSignature: g._renderTargetPoolIdentity(pool, owner),
        poolSignatureMatches: state?.poolSignature === g._renderTargetPoolIdentity(pool, owner),
        targetUuid: kind === 'house' ? state?.targetUuid || null : null,
        liveTargetUuid: kind === 'house' ? pool[0]?.texture?.uuid || null : null,
        failedTargets: kind === 'house'
          ? (state?.failed ? [-1] : []) : [...(state?.failedTargets || [])],
        errors: [...(state?.errors || [])],
        maxSliceMs: state?.maxSliceMs ?? null,
      };
    };
    const shaderSnapshot = () => {
      const state = g.shaderWarmup;
      const jobs = (state?.compileJobs || []).map((entry) => ({
        label: entry.label, error: entry.error || null,
        invalidated: !!entry.invalidated,
        maxSynchronousSliceMs: Math.max(entry.submitDurationMs || 0,
          entry.maxReadinessPollDurationMs || 0, entry.finalizationDurationMs || 0,
          entry.maxSynchronousSliceMs || 0),
      }));
      const slices = ['compileSlices', 'setupSlices', 'textureSlices']
        .flatMap((field) => (state?.[field] || []).map((entry) => ({
          label: entry.label, error: entry.error || null, invalidated: false,
          maxSynchronousSliceMs: entry.ms,
        })));
      return {
        status: state?.status || null,
        generation: state?.generation ?? null,
        readyVariants: [...(state?.readyVariants || [])],
        compileJobsInFlight: state?.compileJobsInFlight ?? null,
        pendingTextures: state?.pendingTextures ?? null,
        completedAt: state?.completedAt ?? null,
        errors: [...(state?.errors || [])],
        operations: [...jobs, ...slices],
      };
    };
    const readySnapshot = (kind, expectedOwnerPassKey = null) => {
      const residency = g.currentGpuResidency;
      const ownerKey = g._ownerGpuResidencyKey(kind);
      const passes = (residency?.ownerPasses || []).filter((entry) =>
        entry.kind === kind && entry.key === ownerKey);
      const pool = capturePool(kind);
      return {
        generation: g._webglGeneration,
        ownerKey,
        ownerPresent: residency?.owners?.has(ownerKey) || false,
        ownerPassKey: expectedOwnerPassKey || passes.at(-1)?.key || null,
        residencyErrors: [...(residency?.errors || [])],
        pool: serializePool(pool),
        target: targetSnapshot(kind),
        shader: shaderSnapshot(),
        pane: paneState(kind),
      };
    };
    const ownerReady = (kind) => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const key = g._ownerGpuResidencyKey(kind);
      const target = targetSnapshot(kind);
      const shader = g.shaderWarmup;
      return !!(progress && residency.generation === g._webglGeneration
        && residency.physical.has(progress.key) && !g.lastRender?.reducedDetail
        && progress.exactQueue.length === 0 && progress.ownerQueue.length === 0
        && progress.ownerExactQueue.length === 0
        && progress.ownerRecorded && progress.ownerExactRecorded
        && residency.owners.has(key) && target.status === 'ready'
        && target.poolRefMatches && target.targetRefsMatch && target.poolSignatureMatches
        && target.failedTargets.length === 0
        && pageVariants(kind).every((name) =>
          shader?.readyVariants?.includes(name))
        && paneState(kind).activeCount > 0);
    };
    const quiescent = (kind) => ownerReady(kind)
      && g.shaderWarmup?.status === 'ready'
      && g.shaderWarmup?.generation === g._webglGeneration
      && g.shaderWarmup?.compileJobsInFlight === 0
      && g.shaderWarmup?.pendingTextures === 0
      && (g.shaderWarmup?.errors || []).length === 0;
    const waitFor = async (predicate, label, timeout = 120000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) await frame();
      if (!predicate()) throw new Error(`Stage C mirror timeout: ${label}`);
    };

    const setupOperations = [];
    const timed = (label, callback) => {
      const startedAt = performance.now();
      let error = null;
      let value;
      try { value = callback(); }
      catch (caught) { error = caught; throw caught; }
      finally {
        setupOperations.push({ label, durationMs: performance.now() - startedAt,
          error: error?.message || null });
      }
      return value;
    };
    const advanceFinale = async (seconds, label) => {
      let remaining = seconds;
      let slice = 0;
      while (remaining > 1e-6) {
        const dt = Math.min(0.2, remaining);
        timed(`${label}:${slice++}`, () => F.stepWith(dt, {}, false));
        remaining -= dt;
        await frame();
      }
    };

    let activeEpisode = null;
    let activeFrame = null;
    let activeDraw = null;
    let previousRaf = null;
    let sampling = true;
    let frameSerial = 0;
    const episodes = {};
    const phaseStack = ['async-outside-render'];
    const withPhase = (label, callback) => {
      phaseStack.push(label);
      try { return callback(); }
      finally { phaseStack.pop(); }
    };
    const outsideGl = makeGl();
    const startEpisode = (label, kind = null) => {
      const episode = {
        label, kind, generation: g._webglGeneration,
        startedAt: performance.now(), frames: 0, rafIntervals: 0,
        firstRafObservedAt: null, stageToFirstObservedRafMs: null,
        maxRenderMs: 0, maxRafMs: 0, slowFrames: [], slowRafs: [],
        shieldedFrames: 0, visibleResourceFrames: [], gl: makeGl(),
        glByPhase: {},
        ownerPasses: [], ownerFrameId: null, ownerFrame: null,
        firstPaneFrameId: null, firstPaneFrame: null,
        firstFullFrameId: null, firstFullFrame: null,
        samples: [], textureBindings: [], keyTransitions: [], preloadPasses: [],
      };
      episodes[label] = episode;
      activeEpisode = episode;
      previousRaf = null;
      return episode;
    };
    const finishEpisode = async (episode) => {
      await frame();
      if (activeEpisode === episode) activeEpisode = null;
      return episode;
    };
    const sampleRaf = (timestamp) => {
      const observedAt = performance.now();
      if (activeEpisode && activeEpisode.firstRafObservedAt == null) {
        activeEpisode.firstRafObservedAt = observedAt;
        activeEpisode.stageToFirstObservedRafMs = observedAt - activeEpisode.startedAt;
      }
      if (activeEpisode && previousRaf?.episode === activeEpisode
          && previousRaf.generation === g._webglGeneration
          && previousRaf.timestamp >= activeEpisode.startedAt
          && timestamp >= activeEpisode.startedAt) {
        const durationMs = timestamp - previousRaf.timestamp;
        activeEpisode.rafIntervals++;
        activeEpisode.maxRafMs = Math.max(activeEpisode.maxRafMs, durationMs);
        if (durationMs >= 100) activeEpisode.slowRafs.push({ durationMs,
          from: previousRaf.timestamp, to: timestamp });
      }
      previousRaf = { episode: activeEpisode, generation: g._webglGeneration,
        timestamp, observedAt };
      if (sampling) requestAnimationFrame(sampleRaf);
    };
    requestAnimationFrame(sampleRaf);

    const originals = {};
    const wrappers = {};
    const boundBuffers = new Map();
    const allocatedBuffers = new WeakSet();
    const bufferIds = new WeakMap();
    const vaoIds = new WeakMap();
    let nextBufferId = 1;
    let nextVaoId = 1;
    const idFor = (map, object, kind) => {
      if (!object) return null;
      let id = map.get(object);
      if (id == null) {
        id = kind === 'buffer' ? nextBufferId++ : nextVaoId++;
        map.set(object, id);
      }
      return id;
    };
    const bucket = () => {
      if (!activeFrame) return outsideGl;
      const label = phaseStack.at(-1) || 'async-outside-render';
      return activeFrame.glByPhase[label] ||= makeGl();
    };
    const sample = (counts, key, row, limit) => {
      if (counts[key].length < limit) counts[key].push(row);
    };
    const hook = (name, callback) => {
      originals[name] = gl[name];
      const wrapper = function stageCMirrorGlHook(...args) {
        return callback.call(this, originals[name], args);
      };
      wrappers[name] = wrapper;
      gl[name] = wrapper;
      if (gl[name] !== wrapper) throw new Error(`could not install GL hook ${name}`);
    };
    hook('bindBuffer', function bindBuffer(original, args) {
      const result = original.apply(this, args);
      boundBuffers.set(args[0], args[1]);
      bucket().bindBuffer++;
      return result;
    });
    hook('bufferData', function bufferData(original, args) {
      const counts = bucket();
      const buffer = boundBuffers.get(args[0]);
      const bytes = Number.isFinite(args[1]) ? Number(args[1])
        : Number(args[1]?.byteLength || 0);
      counts.bufferData++;
      counts.bufferDataBytes += bytes;
      if (buffer) allocatedBuffers.add(buffer);
      sample(counts, 'samples', {
        method: 'bufferData', phase: phaseStack.at(-1), target: args[0], bytes,
        bufferId: idFor(bufferIds, buffer, 'buffer'),
        generation: g._webglGeneration, draw: activeDraw ? { ...activeDraw } : null,
      }, 64);
      return original.apply(this, args);
    });
    hook('bufferSubData', function bufferSubData(original, args) {
      const counts = bucket();
      const buffer = boundBuffers.get(args[0]);
      const bytes = Number(args[2]?.byteLength || 0);
      let size = null;
      let probeError = null;
      try { size = Number(gl.getBufferParameter(args[0], gl.BUFFER_SIZE)); }
      catch (error) { probeError = error?.message || `${error}`; }
      const allocatedBefore = !!buffer && (allocatedBuffers.has(buffer) || size > 0);
      if (allocatedBefore && buffer) allocatedBuffers.add(buffer);
      counts.bufferSubData++;
      counts.bufferSubDataBytes += bytes;
      if (!allocatedBefore) counts.unallocatedBufferSubData++;
      if (probeError) counts.bufferAllocationProbeErrors++;
      sample(counts, 'samples', {
        method: 'bufferSubData', phase: phaseStack.at(-1), target: args[0], bytes,
        allocatedBefore, probeError,
        bufferId: idFor(bufferIds, buffer, 'buffer'),
        generation: g._webglGeneration, draw: activeDraw ? { ...activeDraw } : null,
      }, 64);
      return original.apply(this, args);
    });
    hook('createVertexArray', function createVertexArray(original, args) {
      const vao = original.apply(this, args);
      const counts = bucket();
      counts.createVertexArray++;
      const row = {
        method: 'createVertexArray', phase: phaseStack.at(-1),
        vaoId: idFor(vaoIds, vao, 'vao'), generation: g._webglGeneration,
        draw: activeDraw ? { ...activeDraw } : null,
      };
      sample(counts, 'vaoSamples', row, 192);
      sample(counts, 'samples', row, 64);
      return vao;
    });
    hook('bindVertexArray', function bindVertexArray(original, args) {
      const value = original.apply(this, args);
      bucket().bindVertexArray++;
      return value;
    });

    const realSubmitBatch = g._submitReducedWorldBatch;
    g._submitReducedWorldBatch = function tracedMirrorResidencyBatch(
      progress, options = {},
    ) {
      const label = options.exactOnly
        ? options.ownerOnly ? 'owner-exact-preload'
          : options.deferredOnly ? 'deferred-exact-preload' : 'current-exact-preload'
        : options.ownerOnly ? 'owner-reduced-preload'
          : options.deferredOnly ? 'deferred-reduced-preload' : 'reduced-preload';
      return withPhase(label, () => realSubmitBatch.call(this, progress, options));
    };
    const realExactPass = g._submitExactCurrentPass;
    g._submitExactCurrentPass = function tracedMirrorExactPass(options) {
      return withPhase('exact-certificate', () => realExactPass.call(this, options));
    };
    const realOwnerPass = g._prepareOwnerGpuResidency;
    g._prepareOwnerGpuResidency = function tracedMirrorOwnerPass(kind) {
      return withPhase(`${kind}-owner-certificate`, () => realOwnerPass.call(this, kind));
    };
    const realHouseMirrorRender = g.houseMirror.render;
    g.houseMirror.render = function tracedHousePaneRender(...args) {
      if (phaseStack.at(-1) !== 'visible-render') {
        return realHouseMirrorRender.apply(this, args);
      }
      return withPhase('house-pane-render', () =>
        realHouseMirrorRender.apply(this, args));
    };
    const realFinaleRender = g.finale.render;
    g.finale.render = function tracedFinalePaneRender(...args) {
      if (phaseStack.at(-1) !== 'visible-render') {
        return realFinaleRender.apply(this, args);
      }
      return withPhase('finale-pane-render', () => realFinaleRender.apply(this, args));
    };
    const realRendererRender = renderer.render;
    renderer.render = function tracedRendererRender(scene, camera, ...args) {
      if (phaseStack.at(-1) !== 'visible-render') {
        return realRendererRender.call(this, scene, camera, ...args);
      }
      let label = 'visible-render';
      if (scene === g.grainScene) label = 'grain-visible';
      else if (scene === g.scene && camera === g.camera) {
        label = camera.layers.mask === (1 << 2) ? 'held-visible' : 'world-visible';
      }
      return withPhase(label, () => realRendererRender.call(this, scene, camera, ...args));
    };
    const realRenderBufferDirect = renderer.renderBufferDirect;
    renderer.renderBufferDirect = function tracedRenderBufferDirect(
      camera, scene, geometry, material, object, group,
    ) {
      const previous = activeDraw;
      activeDraw = {
        object: object?.name || object?.type || '(unnamed)',
        objectType: object?.type || null,
        objectUuid: object?.uuid || null,
        geometryUuid: geometry?.uuid || null,
        material: material?.name || material?.type || '(unnamed)',
        materialType: material?.type || null,
        materialUuid: material?.uuid || null,
        layers: object?.layers?.mask ?? null,
        camera: camera?.name || camera?.type || null,
        cameraLayers: camera?.layers?.mask ?? null,
        targetUuid: renderer.getRenderTarget()?.texture?.uuid || null,
      };
      try {
        return realRenderBufferDirect.call(this,
          camera, scene, geometry, material, object, group);
      } finally { activeDraw = previous; }
    };
    const drawHookRestores = [];
    const drawStack = [];
    const hookedDrawObjects = new Set();
    const installDrawIdentityHooks = (root) => root?.traverse?.((object) => {
      if (hookedDrawObjects.has(object.uuid)
          || (!object.isMesh && !object.isLine && !object.isPoints)
          || !object.geometry || !object.material) return;
      hookedDrawObjects.add(object.uuid);
      const before = object.onBeforeRender;
      const after = object.onAfterRender;
      object.onBeforeRender = function stageCMirrorDrawIdentity(
        activeRenderer, scene, camera, geometry, material, group,
      ) {
        before?.call(this, activeRenderer, scene, camera, geometry, material, group);
        drawStack.push(activeDraw);
        activeDraw = {
          object: this.name || this.type || '(unnamed)',
          objectType: this.type || null,
          objectUuid: this.uuid || null,
          geometryUuid: geometry?.uuid || null,
          material: material?.name || material?.type || '(unnamed)',
          materialType: material?.type || null,
          materialUuid: material?.uuid || null,
          layers: this.layers?.mask ?? null,
          camera: camera?.name || camera?.type || null,
          cameraLayers: camera?.layers?.mask ?? null,
          targetUuid: activeRenderer?.getRenderTarget?.()?.texture?.uuid || null,
        };
      };
      object.onAfterRender = function stageCMirrorDrawIdentityRestore(
        activeRenderer, scene, camera, geometry, material, group,
      ) {
        try { after?.call(this, activeRenderer, scene, camera, geometry, material, group); }
        finally { activeDraw = drawStack.pop() ?? null; }
      };
      drawHookRestores.push(() => {
        object.onBeforeRender = before;
        object.onAfterRender = after;
      });
    });
    for (const root of [
      g.scene, g.grainScene, g.finale.figure, g.finale.figure?.userData?.exactHead,
      ...(g.finale.warmRoots || []), ...(g.staticWorldRenderRoots || []),
      ...(g.houseRenderRoots || []), g.houseMirror.double, g.houseMirror.echo,
    ]) installDrawIdentityHooks(root);
    const trace = {
      installed: Object.entries(wrappers).every(([name, wrapper]) => gl[name] === wrapper),
      healthyBeforeRestore: null,
    };

    const realRender = g.render;
    g.render = function measuredMirrorRender(...args) {
      const before = stats();
      const residency = g.currentGpuResidency;
      const passBefore = {
        reduced: residency?.reducedPasses?.length || 0,
        exactPreload: residency?.exactPreloadPasses?.length || 0,
        exact: residency?.exactPasses?.length || 0,
        owner: residency?.ownerPasses?.length || 0,
        transitions: residency?.keyTransitions?.length || 0,
      };
      const row = activeFrame = {
        frameId: ++frameSerial, generation: g._webglGeneration,
        episode: activeEpisode?.label || 'unowned', act: g.act,
        startedAt: performance.now(), gl: makeGl(), glByPhase: {},
      };
      try { return withPhase('visible-render', () => realRender.apply(this, args)); }
      finally {
        const live = g.currentGpuResidency;
        const after = stats();
        for (const counts of Object.values(row.glByPhase)) addGl(row.gl, counts);
        row.renderMs = performance.now() - row.startedAt;
        row.worldDrawCalls = g.lastRender?.worldDrawCalls || 0;
        row.reducedDetail = !!g.lastRender?.reducedDetail;
        row.shielded = !!g._shaderTransitionShield;
        row.visibleProgramDelta = g.lastRender?.visibleProgramDelta || 0;
        row.visibleTextureDelta = g.lastRender?.visibleTextureDelta || 0;
        row.visibleGeometryDelta = g.lastRender?.visibleGeometryDelta || 0;
        row.rawProgramDelta = after.programs - before.programs;
        row.rawTextureDelta = after.textures - before.textures;
        row.rawGeometryDelta = after.geometries - before.geometries;
        row.housePaneActive = !!g.houseMirror?.pane?.active;
        row.houseTextureUuid = g.houseMirror?.pane?.material?.uniforms
          ?.tDiffuse?.value?.uuid || null;
        row.finalePaneCount = g.finale?.panes?.filter((pane) => pane.active).length || 0;
        row.finaleTextureUuids = (g.finale?.panes || []).map((pane) =>
          pane.material.uniforms.tDiffuse.value?.uuid || null).filter(Boolean);
        row.housePoolTextureUuids = (g.houseMirror?.pool?.pool || [])
          .map((target) => target.texture?.uuid || null).filter(Boolean);
        row.finalePoolTextureUuids = (g.finale?.mirrors?.pool || [])
          .map((target) => target.texture?.uuid || null).filter(Boolean);
        row.reducedPassRange = [passBefore.reduced,
          live?.reducedPasses?.length || 0];
        row.exactPreloadRange = [passBefore.exactPreload,
          live?.exactPreloadPasses?.length || 0];
        row.exactPassRange = [passBefore.exact, live?.exactPasses?.length || 0];
        row.ownerPassRange = [passBefore.owner, live?.ownerPasses?.length || 0];
        row.keyTransitionRange = [passBefore.transitions,
          live?.keyTransitions?.length || 0];
        row.exactPreloadKinds = clone((live?.exactPreloadPasses || [])
          .slice(...row.exactPreloadRange).map((entry) => entry.kind));
        row.preloadPasses = clone([
          ...(live?.reducedPasses || []).slice(...row.reducedPassRange),
          ...(live?.exactPreloadPasses || []).slice(...row.exactPreloadRange),
        ].map((entry) => ({
          generation: entry.generation, key: entry.key, kind: entry.kind,
          durationMs: entry.durationMs, programDelta: entry.programDelta,
          textureDelta: entry.textureDelta, geometryDelta: entry.geometryDelta,
          committed: entry.committed, stateRestored: entry.stateRestored,
          generationStable: entry.generationStable,
          fingerprintsStable: entry.fingerprintsStable,
          queuePrefixStable: entry.queuePrefixStable,
          error: entry.error, identity: entry.identity || null,
        })));
        row.keyTransitions = clone((live?.keyTransitions || [])
          .slice(...row.keyTransitionRange));
        row.ownerPasses = clone((live?.ownerPasses || []).slice(passBefore.owner)
          .map((entry) => ({ generation: entry.generation, key: entry.key,
            kind: entry.kind, durationMs: entry.durationMs, rendered: entry.rendered,
            programDelta: entry.programDelta, textureDelta: entry.textureDelta,
            geometryDelta: entry.geometryDelta, error: entry.error,
            identity: entry.identity || null })));
        const episode = activeEpisode;
        if (episode) {
          episode.frames++;
          episode.maxRenderMs = Math.max(episode.maxRenderMs, row.renderMs);
          addGl(episode.gl, row.gl);
          for (const [phase, counts] of Object.entries(row.glByPhase)) {
            episode.glByPhase[phase] ||= makeGl();
            addGl(episode.glByPhase[phase], counts);
          }
          episode.keyTransitions.push(...row.keyTransitions);
          episode.preloadPasses.push(...row.preloadPasses);
          if (row.renderMs >= 100) episode.slowFrames.push(clone(row));
          if (row.shielded) episode.shieldedFrames++;
          if (row.worldDrawCalls > 0 && (row.visibleProgramDelta !== 0
              || row.visibleTextureDelta !== 0 || row.visibleGeometryDelta !== 0)) {
            episode.visibleResourceFrames.push(clone(row));
          }
          if (episode.firstFullFrameId == null && row.worldDrawCalls > 0
              && !row.reducedDetail) {
            episode.firstFullFrameId = row.frameId;
            episode.firstFullFrame = clone(row);
          }
          const ownerPasses = row.ownerPasses.filter((entry) =>
            entry.kind === episode.kind);
          if (ownerPasses.length) {
            episode.ownerPasses.push(...ownerPasses);
            if (episode.ownerFrameId == null) {
              episode.ownerFrameId = row.frameId;
              episode.ownerFrame = clone(row);
            }
          }
          const paneActive = episode.kind === 'house'
            ? row.housePaneActive : row.finalePaneCount > 0;
          const panePhase = episode.kind === 'house'
            ? row.glByPhase['house-pane-render'] : row.glByPhase['finale-pane-render'];
          const paneTextures = episode.kind === 'house'
            ? [row.houseTextureUuid].filter(Boolean) : row.finaleTextureUuids;
          const poolTextures = episode.kind === 'house'
            ? row.housePoolTextureUuids : row.finalePoolTextureUuids;
          const paneSubmittedCurrentPool = !!panePhase && paneTextures.length > 0
            && paneTextures.every((uuid) => poolTextures.includes(uuid));
          if (episode.ownerFrameId != null && episode.firstPaneFrameId == null
              && row.frameId > episode.ownerFrameId && paneActive
              && paneSubmittedCurrentPool) {
            episode.firstPaneFrameId = row.frameId;
            episode.firstPaneFrame = clone(row);
          }
          episode.textureBindings.push(...(episode.kind === 'house'
            ? [row.houseTextureUuid].filter(Boolean) : row.finaleTextureUuids));
          if (episode.samples.length < 5 || ownerPasses.length
              || row.frameId === episode.firstPaneFrameId || row.renderMs >= 100) {
            episode.samples.push(clone(row));
          }
        }
        activeFrame = null;
      }
    };

    const rendererState = () => ({
      target: renderer.getRenderTarget(),
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
      viewport: Array.from(gl.getParameter(gl.VIEWPORT)),
      scissor: Array.from(gl.getParameter(gl.SCISSOR_BOX)),
      scissorTest: gl.isEnabled(gl.SCISSOR_TEST),
      autoClear: renderer.autoClear,
      cameraMask: g.camera.layers.mask,
    });
    const containment = (before, after, beforeVisibility, afterVisibility) => ({
      rendererTargetRestored: after.target === before.target,
      framebufferRestored: after.framebuffer === before.framebuffer,
      viewportRestored: sameArray(after.viewport, before.viewport),
      scissorRestored: sameArray(after.scissor, before.scissor),
      scissorTestRestored: after.scissorTest === before.scissorTest,
      autoClearRestored: after.autoClear === before.autoClear,
      cameraMaskRestored: after.cameraMask === before.cameraMask,
      scopeVisibilityRestored: sameArray(afterVisibility, beforeVisibility),
    });
    const positionHouseMirror = () => {
      g.houseMirror.awakened = true;
      g.player.pos.set(g.houseMirror.pos.x + 2.1, 0, g.houseMirror.pos.z);
      g.player.yaw = Math.PI / 2;
      g.player.pitch = 0;
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
    };
    const topRoots = () => [...new Set([
      ...(g.houseRenderRoots || []), ...(g.outsideRenderRoots || []),
      g.atmosphere?.group,
    ].filter((root) => root?.parent === g.scene))];
    const visibilitySnapshot = () => topRoots().map((root) => ({
      root, uuid: root.uuid, name: root.name || root.type, visible: root.visible,
    }));
    const serializeVisibility = (rows) => rows.map(({ uuid, name, visible }) =>
      ({ uuid, name, visible }));

    const replacement = async (kind, size, label) => {
      const before = capturePool(kind);
      const residency = g.currentGpuResidency;
      const passBefore = residency.ownerPasses.length;
      const changeBefore = residency.poolChanges?.length || 0;
      const disposeCounts = before.targets.map(() => 0);
      before.targets.forEach((target, index) => target.addEventListener('dispose', () => {
        disposeCounts[index]++;
      }));
      const episode = startEpisode(label, kind);
      const startedAt = performance.now();
      let error = null;
      try { before.owner.setSize(size); }
      catch (caught) { error = caught; throw caught; }
      const action = { label: `${kind}-set-size`,
        durationMs: performance.now() - startedAt, error: error?.message || null };
      setupOperations.push(action);
      const next = capturePool(kind);
      const immediatePane = paneState(kind);
      const shader = g.shaderWarmup;
      const immediate = {
        generationUnchanged: g._webglGeneration === before.generation,
        poolEpochAdvancedOnce: next.poolEpoch === before.poolEpoch + 1,
        poolRefChanged: next.pool !== before.pool,
        targetsAllChanged: next.targets.every((target) => !before.targets.includes(target)),
        textureUuidsDisjoint: next.textureUuids.every((uuid) =>
          !before.textureUuids.includes(uuid)),
        oldTargetsDisposedOnce: disposeCounts.every((count) => count === 1),
        disposeCounts,
        oldOwnerRetired: !residency.owners.has(before.ownerKey),
        panesDark: immediatePane.allDark && immediatePane.doubleHidden,
        labelsRetired: pageRetiredVariants(kind).every((name) =>
          !g._shaderResidentVariants.has(name)
            && !(shader.carriedReadyVariants || []).includes(name)
            && !(shader.readyVariants || []).includes(name)),
        poolChangeRows: (residency.poolChanges?.length || 0) - changeBefore,
        before: serializePool(before), next: serializePool(next),
      };
      await waitFor(() => quiescent(kind), `${label} recertification`);
      await frame();
      const ownerPasses = g.currentGpuResidency.ownerPasses.slice(passBefore)
        .filter((entry) => entry.kind === kind && entry.key === next.ownerKey);
      await finishEpisode(episode);
      const ready = readySnapshot(kind, ownerPasses.at(-1)?.key || null);
      return {
        episode: label, action, immediate,
        recovered: {
          generationUnchanged: g._webglGeneration === episode.generation,
          ownerKeyChanged: next.ownerKey !== before.ownerKey,
          oldUuidRebindings: episode.textureBindings.filter((uuid) =>
            before.textureUuids.includes(uuid)),
          ready,
        },
      };
    };

    const injectFault = async (kind, fault, label) => {
      const beforePool = capturePool(kind);
      const generation = g._webglGeneration;
      const residency = g.currentGpuResidency;
      const passBefore = residency.ownerPasses.length;
      const mirrors = poolFor(kind);
      const beforeState = rendererState();
      const beforeVisibility = panesFor(kind).map((pane) => pane.mesh.visible);
      const serialBefore = mirrors._failureSerial;
      const episode = startEpisode(label, kind);
      const original = fault === 'render' ? renderer.render : renderer.setRenderTarget;
      let fired = false;
      let escaped = null;
      let sawPool = false;
      const outerTarget = beforeState.target;
      try {
        if (fault === 'render') {
          renderer.render = function injectedMirrorRender(...args) {
            const target = renderer.getRenderTarget();
            if (!fired && beforePool.targets.includes(target)) {
              fired = true;
              throw new Error(`injected ${kind} render fault`);
            }
            return original.apply(this, args);
          };
        } else {
          renderer.setRenderTarget = function injectedMirrorTarget(target, ...args) {
            if (fault === 'bind' && !fired && beforePool.targets.includes(target)) {
              fired = true;
              throw new Error(`injected ${kind} bind fault`);
            }
            if (fault === 'restore' && !fired && sawPool && target === outerTarget) {
              fired = true;
              throw new Error(`injected ${kind} restore fault`);
            }
            const value = original.call(this, target, ...args);
            if (beforePool.targets.includes(target)) sawPool = true;
            return value;
          };
        }
        await waitFor(() => fired, `${label} injection`, 20000);
      } catch (caught) {
        escaped = caught?.message || `${caught}`;
      } finally {
        if (fault === 'render') renderer.render = original;
        else renderer.setRenderTarget = original;
      }
      const afterState = rendererState();
      const afterVisibility = panesFor(kind).map((pane) => pane.mesh.visible);
      const immediatePane = paneState(kind);
      const livePool = capturePool(kind);
      const target = targetSnapshot(kind);
      const shader = g.shaderWarmup;
      const immediate = {
        generationUnchanged: g._webglGeneration === generation,
        poolIdentityUnchanged: livePool.pool === beforePool.pool
          && livePool.poolEpoch === beforePool.poolEpoch
          && sameArray(livePool.textureUuids, beforePool.textureUuids),
        ownerRetired: !residency.owners.has(beforePool.ownerKey),
        panesDark: immediatePane.allDark && immediatePane.doubleHidden,
        recoveryInvalidated: target.status !== 'ready'
          && pageRetiredVariants(kind).every((name) =>
            !g._shaderResidentVariants.has(name)
              && !(shader.carriedReadyVariants || []).includes(name)
              && !(shader.readyVariants || []).includes(name)),
        targetStatus: target.status, shaderStatus: shader.status,
      };
      await waitFor(() => quiescent(kind), `${label} automatic recovery`);
      await frame();
      const ownerPasses = g.currentGpuResidency.ownerPasses.slice(passBefore)
        .filter((entry) => entry.kind === kind && entry.key === beforePool.ownerKey);
      await finishEpisode(episode);
      const afterPool = capturePool(kind);
      const ready = readySnapshot(kind, ownerPasses.at(-1)?.key || null);
      return {
        episode: label, kind, fault, fired, escaped,
        methodRestored: fault === 'render'
          ? renderer.render === original : renderer.setRenderTarget === original,
        failureSerialDelta: mirrors._failureSerial - serialBefore,
        failure: clone(mirrors.lastFailure),
        containment: containment(beforeState, afterState,
          beforeVisibility, afterVisibility),
        immediate,
        recovered: {
          generationUnchanged: g._webglGeneration === generation,
          poolIdentityUnchanged: afterPool.pool === beforePool.pool
            && afterPool.poolEpoch === beforePool.poolEpoch
            && sameArray(afterPool.textureUuids, beforePool.textureUuids),
          ownerKeyUnchanged: afterPool.ownerKey === beforePool.ownerKey,
          ready,
        },
      };
    };

    let baseline;
    let replacements;
    let faults;
    let leave;
    let finaleEntry;
    try {
      const houseInitial = startEpisode('house-initial', 'house');
      timed('wake', () => F.start());
      g._selfStep = false;
      timed('teleport-house', () => F.teleport('house'));
      if (g.skull.mode !== 'held') g.skull.holdNow();
      timed('position-house-mirror', positionHouseMirror);
      await waitFor(() => quiescent('house'), 'initial House owner readiness');
      await finishEpisode(houseInitial);
      const baselineRows = visibilitySnapshot();
      baseline = {
        generation: g._webglGeneration,
        visibility: serializeVisibility(baselineRows),
        house: readySnapshot('house'),
      };

      replacements = {
        house: await replacement('house', 383, 'house-replacement'),
      };
      faults = {
        houseBind: await injectFault('house', 'bind', 'house-bind-fault'),
      };

      const finaleInitial = startEpisode('finale-initial', 'finale');
      timed('teleport-finale', () => F.teleport('mirror'));
      const exactHead = g.finale.figure?.userData?.exactHead;
      installDrawIdentityHooks(exactHead);
      finaleEntry = {
        skullMode: g.skull.mode,
        skullParent: g.skull.root.parent?.name || g.skull.root.parent?.type || null,
        tetherVisible: g.skull.tether.visible,
        exactHeadPresent: !!exactHead,
        exactHeadMounted: exactHead?.parent === g.finale.figure?.userData?.headMount,
      };
      g.player.yaw = Math.PI;
      g.player.pitch = 0;
      g.player._sync(0);
      await waitFor(() => quiescent('finale'), 'initial Finale owner readiness');
      await finishEpisode(finaleInitial);
      replacements.finale = await replacement('finale', 1023, 'finale-replacement');
      faults.finaleRender = await injectFault('finale', 'render', 'finale-render-fault');
      faults.finaleRestore = await injectFault('finale', 'restore', 'finale-restore-fault');

      // Exercise the production closing-room pressure/tension path before the
      // lifecycle exit. The frozen flag is injected deliberately because its
      // natural production edge is the terminal hard-black sequence; reaching
      // that edge would end the page instead of testing a same-page act exit.
      const pressureEpisode = startEpisode('finale-pressure-precondition', null);
      await advanceFinale(8.4, 'advance-finale-closing');
      timed('position-finale-pressure-contact', () => {
        const inset = Math.max(0.01, g.finale.half - 0.34);
        g.player.pos.set(500, 0, 500 - inset + 0.005);
        g.player.yaw = 0;
        g.player.pitch = 0;
        g.player.vel.set(0, 0, -4);
        g.player._sync(0);
      });
      timed('apply-finale-pressure-production-path', () =>
        g.finale._updatePressure(0.2, true));
      await frame();
      const pressureHands = g.finale.emptyHands;
      const handsDisplaced = !!pressureHands && (
        !pressureHands.hold.position.equals(pressureHands.holdPos)
          || !pressureHands.hold.rotation.equals(pressureHands.holdRot)
          || !pressureHands.hold.scale.equals(pressureHands.holdScale)
          || !pressureHands.left.rotation.equals(pressureHands.leftRot)
          || !pressureHands.right.rotation.equals(pressureHands.rightRot));
      const forestBefore = {
        active: g.forest.backDistrictCullActive,
        savedRoots: g.forest.backDistrictVisibility.size,
      };
      const leavePrecondition = {
        phase: g.finale.phase,
        t: g.finale.t,
        half: g.finale.half,
        handPressure: g.finale._handPressure,
        wallPressure: [...g.finale._wallPressure],
        handsDisplaced,
        baseTension: g.baseTension,
        audioTension: g.audio._tension,
        playerFrozenBeforeInjection: g.player.frozen,
        frozenLifecyclePreconditionInjected: true,
        forest: forestBefore,
      };
      timed('inject-frozen-lifecycle-precondition', () => { g.player.frozen = true; });
      leavePrecondition.playerFrozen = g.player.frozen;
      await finishEpisode(pressureEpisode);

      const leaveEpisode = startEpisode('finale-leave-house', 'house');
      const isolationBefore = clone(g.finale.visibilityIsolation);
      const restoreRunsBefore = g.finale.visibilityIsolation.restoreRuns;
      const leaveStartedAt = performance.now();
      let leaveError = null;
      try { F.teleport('house'); }
      catch (caught) { leaveError = caught; throw caught; }
      const leaveDurationMs = performance.now() - leaveStartedAt;
      setupOperations.push({ label: 'leave-finale-to-house',
        durationMs: leaveDurationMs, error: leaveError?.message || null });
      positionHouseMirror();
      await waitFor(() => leaveEpisode.firstFullFrame?.act === 'house'
        && leaveEpisode.firstFullFrame.worldDrawCalls > 0
        && leaveEpisode.firstFullFrame.reducedDetail === false
        && leaveEpisode.firstFullFrame.finalePaneCount === 0
        && quiescent('house'),
      'House physical and owner recertification after Finale leave');
      await finishEpisode(leaveEpisode);
      const currentVisibility = visibilitySnapshot();
      const expectedMap = new Map(baselineRows.map((entry) => [entry.uuid, entry.visible]));
      const hands = g.finale.emptyHands;
      leave = {
        durationMs: leaveDurationMs,
        act: g.act,
        finaleActive: g.finale.active,
        finalePhase: g.finale.phase,
        panes: paneState('finale'),
        figureVisible: g.finale.figure.visible,
        playerFrozen: g.player.frozen,
        handPressure: g.finale._handPressure,
        wallPressure: [...g.finale._wallPressure],
        handsRestored: !hands || (hands.hold.position.equals(hands.holdPos)
          && hands.hold.rotation.equals(hands.holdRot)
          && hands.hold.scale.equals(hands.holdScale)
          && hands.left.rotation.equals(hands.leftRot)
          && hands.right.rotation.equals(hands.rightRot)),
        baseTension: g.baseTension,
        audioTension: g.audio._tension,
        precondition: leavePrecondition,
        isolationBefore,
        isolationAfter: clone(g.finale.visibilityIsolation),
        restoreRunsDelta: g.finale.visibilityIsolation.restoreRuns - restoreRunsBefore,
        savedRoots: g.finale._visibilityIsolationSaved.size,
        forestCullActive: g.forest.backDistrictCullActive,
        forestSavedRoots: g.forest.backDistrictVisibility.size,
        visibility: serializeVisibility(currentVisibility),
        visibilityMatchesBaseline: currentVisibility.length === baselineRows.length
          && currentVisibility.every((entry) =>
            expectedMap.has(entry.uuid) && expectedMap.get(entry.uuid) === entry.visible),
        nextFrame: clone(leaveEpisode.firstFullFrame || null),
      };
    } finally {
      sampling = false;
      activeEpisode = null;
      trace.healthyBeforeRestore = Object.entries(wrappers).every(([name, wrapper]) =>
        gl[name] === wrapper);
      trace.methodHealthyBeforeRestore = g._submitReducedWorldBatch
          !== realSubmitBatch && g._submitExactCurrentPass !== realExactPass
          && g._prepareOwnerGpuResidency !== realOwnerPass
          && g.houseMirror.render !== realHouseMirrorRender
          && g.finale.render !== realFinaleRender
          && renderer.render !== realRendererRender
          && renderer.renderBufferDirect !== realRenderBufferDirect;
      g.render = realRender;
      g._submitReducedWorldBatch = realSubmitBatch;
      g._submitExactCurrentPass = realExactPass;
      g._prepareOwnerGpuResidency = realOwnerPass;
      g.houseMirror.render = realHouseMirrorRender;
      g.finale.render = realFinaleRender;
      renderer.render = realRendererRender;
      renderer.renderBufferDirect = realRenderBufferDirect;
      for (const restore of drawHookRestores.reverse()) restore();
      activeDraw = null;
      drawStack.length = 0;
      for (const [name, original] of Object.entries(originals)) gl[name] = original;
    }

    const serializeEpisode = (episode) => ({
      label: episode.label, kind: episode.kind, generation: episode.generation,
      startedAt: episode.startedAt, frames: episode.frames,
      rafIntervals: episode.rafIntervals,
      stageToFirstObservedRafMs: episode.stageToFirstObservedRafMs,
      maxRenderMs: episode.maxRenderMs, maxRafMs: episode.maxRafMs,
      slowFrames: episode.slowFrames, slowRafs: episode.slowRafs,
      shieldedFrames: episode.shieldedFrames,
      visibleResourceFrames: episode.visibleResourceFrames,
      gl: episode.gl, glByPhase: episode.glByPhase,
      ownerPasses: episode.ownerPasses,
      ownerFrameId: episode.ownerFrameId, ownerFrame: episode.ownerFrame,
      firstPaneFrameId: episode.firstPaneFrameId,
      firstPaneFrame: episode.firstPaneFrame,
      firstFullFrameId: episode.firstFullFrameId,
      firstFullFrame: episode.firstFullFrame,
      keyTransitions: episode.keyTransitions,
      preloadPasses: episode.preloadPasses,
      samples: episode.samples,
    });
    const debugRenderer = gl.getExtension('WEBGL_debug_renderer_info');
    return clone({
      renderer: debugRenderer
        ? gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      webgl2: renderer.capabilities.isWebGL2,
      generation: g._webglGeneration,
      setupOperations,
      baseline,
      finaleEntry,
      replacements,
      faults,
      leave,
      outsideGl,
      episodes: Object.fromEntries(Object.entries(episodes)
        .map(([key, episode]) => [key, serializeEpisode(episode)])),
      trace,
    });
  });

  Object.assign(report, result);
  report.browserErrors = [...opened.errors];
  check(/Direct3D11.*D3D11/.test(report.renderer),
    'live mirror gate uses real ANGLE D3D11', report.renderer);
  check(report.webgl2 === true, 'live mirror gate uses WebGL2', report.webgl2);
  check(report.generation === 0,
    'all replacement and fault recovery stays in generation zero', report.generation);
  check(report.setupOperations.length > 0
      && report.setupOperations.every((entry) => entry.error == null
        && entry.durationMs < 100),
  'every named lifecycle setup operation is strictly sub-100ms', report.setupOperations);
  check(report.trace?.installed === true && report.trace?.healthyBeforeRestore === true
      && report.trace?.methodHealthyBeforeRestore === true,
    'GL trace remains installed until deliberate cleanup', report.trace);
  check(report.outsideGl?.bufferData === 0
      && report.outsideGl?.createVertexArray === 0
      && report.outsideGl?.unallocatedBufferSubData === 0
      && report.outsideGl?.bufferAllocationProbeErrors === 0,
  'no unowned async/global work primes a buffer or VAO outside a named render phase',
  report.outsideGl);

  validateReady('initial House', report.baseline?.house, 'house');
  validateEpisode('initial House episode', report.episodes['house-initial'], {
    owner: true, coldFree: false,
  });
  validateReplacement('House pool', report.replacements?.house, 'house');
  validateFault('House bind fault', report.faults?.houseBind,
    'house', 'bind-pane-target');
  check(report.finaleEntry?.skullMode === 'gone'
      && report.finaleEntry.skullParent == null
      && report.finaleEntry.tetherVisible === false
      && report.finaleEntry.exactHeadPresent === true
      && report.finaleEntry.exactHeadMounted === true,
  'direct Finale entry enforces the shipping no-skull law while retaining its reflected head',
  report.finaleEntry);
  validateEpisode('initial Finale episode', report.episodes['finale-initial'], {
    owner: true, coldFree: false,
  });
  const finaleTransition = report.episodes['finale-initial']?.keyTransitions
    ?.find((entry) => entry.key?.includes(':mirror:'));
  check(finaleTransition?.previousKey?.includes(':house:')
      && finaleTransition.destinationPhysicalWasResident === false
      && finaleTransition.destinationPhysicalRetired === true
      && finaleTransition.destinationReducedRetired === true
      && finaleTransition.retiredOwners?.some((key) => key.includes(':house:')),
  'House-to-Finale opens a new physical proof and retires the House owner certificate',
  finaleTransition);
  validateReplacement('Finale pool', report.replacements?.finale, 'finale');
  validateFault('Finale render fault', report.faults?.finaleRender,
    'finale', 'render-pane');
  validateFault('Finale restore fault', report.faults?.finaleRestore,
    'finale', 'restore-pane-target');
  validateEpisode('Finale pressure precondition episode',
    report.episodes['finale-pressure-precondition'], { owner: false });

  const leave = report.leave;
  check(leave?.precondition?.phase === 'closing' && leave.precondition.t >= 8.3
      && leave.precondition.half < 3
      && leave.precondition.handPressure > 0
      && leave.precondition.wallPressure?.some((value) => value > 0)
      && leave.precondition.handsDisplaced === true
      && leave.precondition.baseTension > 0 && leave.precondition.audioTension > 0
      && leave.precondition.playerFrozenBeforeInjection === false
      && leave.precondition.frozenLifecyclePreconditionInjected === true
      && leave.precondition.playerFrozen === true,
  'Finale leave begins from exercised pressure, hand, tension, and frozen-player state',
  leave?.precondition);
  check(leave?.durationMs < 100 && leave?.act === 'house'
      && leave?.finaleActive === false && leave?.finalePhase === 'idle'
      && leave?.panes?.allDark === true && leave?.panes?.activeCount === 0
      && leave?.figureVisible === false && leave?.playerFrozen === false
      && leave?.handPressure === 0 && leave?.wallPressure?.every((value) => value === 0)
      && leave?.handsRestored === true && leave?.baseTension === 0
      && leave?.audioTension === 0,
  'Finale leave is bounded and retires every visible Finale consumer', leave);
  check(leave?.isolationBefore?.active === true
      && leave?.isolationAfter?.active === false
      && leave?.isolationAfter?.allHidden === false
      && leave?.isolationAfter?.restoreDurationMs < 100
      && leave?.restoreRunsDelta === 1 && leave?.savedRoots === 0,
  'Finale leave restores and clears its exact visibility snapshot once', leave);
  check(leave?.precondition?.forest?.active === true
      && leave.precondition.forest.savedRoots > 0
      && leave?.forestCullActive === false && leave?.forestSavedRoots === 0
      && leave?.visibilityMatchesBaseline === true,
  'mirror exit releases the forest boundary and restores every authored top-level root', leave);
  validateEpisode('Finale leave House episode', report.episodes['finale-leave-house'],
    { owner: true, coldFree: false });
  const houseReturnTransition = report.episodes['finale-leave-house']?.keyTransitions
    ?.find((entry) => entry.key?.includes(':house:'));
  check(houseReturnTransition?.previousKey?.includes(':mirror:')
      && houseReturnTransition.destinationPhysicalWasResident === true
      && houseReturnTransition.destinationPhysicalRetired === true
      && houseReturnTransition.destinationReducedRetired === true
      && houseReturnTransition.retiredOwners?.some((key) => key.includes(':finale:')),
  'Finale-to-House detects and retires the stale destination proof and Finale owner certificate',
  houseReturnTransition);
  check(report.episodes['finale-leave-house']?.firstFullFrame?.act === 'house'
      && report.episodes['finale-leave-house'].firstFullFrame.worldDrawCalls > 0
      && report.episodes['finale-leave-house'].firstFullFrame.reducedDetail === false
      && report.episodes['finale-leave-house'].firstFullFrame.finalePaneCount === 0,
  'the next House physical frame is nonempty and performs no stale Finale render',
  report.episodes['finale-leave-house']?.firstFullFrame);
  check(report.browserErrors.length === 0,
    'expected injected faults emit zero page or console errors', report.browserErrors);
} catch (error) {
  failures.push({
    message: 'Stage C live mirror gate crashed',
    detail: { error: error?.stack || `${error}`, browserErrors: opened?.errors || [] },
  });
  report.browserErrors = [...(opened?.errors || [])];
  console.error(error?.stack || error);
} finally {
  await browser?.close().catch(() => {});
  server?.stop();
  writeFileSync(resultsPath('transition-stage-c-mirror-lifecycle-regression.json'),
    `${JSON.stringify(report, null, 2)}\n`);
}

if (failures.length) {
  console.error(`\n${failures.length} Stage C live mirror regression(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nSTAGE C LIVE MIRROR LIFECYCLE REGRESSION PASSED');
}

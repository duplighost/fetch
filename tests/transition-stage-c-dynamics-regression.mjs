// Focused Stage C gameplay/district residency gate.
//
// One serial system-Chrome/D3D11 process owns three fresh pages:
//   1. real throw/catch, tree-key carry, and offscreen growth;
//   2. a real swept guest-candle theft;
//   3. a real swept basement-pilot theft followed by the five physical
//      deferred-district promotion boundaries.
//
// The gate never calls a target callback, flameCircuit.absorb, setStage,
// holdNow, or a residency submission method to manufacture success. Private
// district probes use cloned BufferAttributes and shipping materials so the GL
// trace can prove Mesh/Line/Points allocation and binding happen in hidden,
// capped production transactions before their first exact visible draw.
import { writeFileSync } from 'node:fs';
import {
  ensureServer, launchBrowser, openPage, PORT, URL_BASE, resultsPath,
} from './lib/harness.mjs';

const CAPS = Object.freeze({
  geometries: 16,
  objects: 32,
  bytes: 512 * 1024,
  elements: 16 * 1024,
});
const URL = `${URL_BASE}/?test=1&mute=1&warmup=1&warmupRace=1&gpuidentity=1`;
const SCENARIOS = ['house-actions', 'guest-flame', 'pilot-districts'];
const failures = [];
const report = {
  url: URL,
  port: PORT,
  scope: 'stage-c-dynamics',
  postCommitContract:
    'allocation, mapping, and program identity for the certified snapshot; dynamic content versions may bufferSubData only to already allocated buffers',
  caps: CAPS,
  expectedPages: SCENARIOS,
  browser: { launches: 0, renderer: null, webgl2: null },
  pages: {},
  browserErrors: [],
  failures,
  durationMs: null,
};
const suiteStartedAt = performance.now();
const round = (value) => Number.isFinite(value) ? +value.toFixed(3) : null;
const cleanRound = (value) => {
  if (Array.isArray(value)) return value.map(cleanRound);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
      [key, cleanRound(entry)]));
  }
  return typeof value === 'number' ? round(value) : value;
};
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};

const pageCapture = async (page, scenario) => page.evaluate(async ({ scenario, caps }) => {
  const pageStartedAt = performance.now();
  const g = window.__game;
  const F = window.__FETCH;
  const renderer = g.renderer;
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined'
    && gl instanceof WebGL2RenderingContext;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const assertions = [];
  const assert = (condition, message, detail = null) => {
    assertions.push({ passed: !!condition, message, detail: clone(detail) });
    return !!condition;
  };
  const require = (condition, message, detail = null) => {
    if (!assert(condition, message, detail)) {
      throw new Error(`${message}${detail == null ? '' : ` -- ${JSON.stringify(detail)}`}`);
    }
  };
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const stats = () => ({
    programs: renderer.info.programs?.length || 0,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
  });
  const deltaStats = (before, after) => ({
    programs: after.programs - before.programs,
    textures: after.textures - before.textures,
    geometries: after.geometries - before.geometries,
  });
  const makeGl = () => ({
    bindBuffer: 0,
    bufferData: 0,
    bufferDataBytes: 0,
    bufferSubData: 0,
    bufferSubDataBytes: 0,
    unallocatedBufferSubData: 0,
    bufferAllocationProbeErrors: 0,
    createVertexArray: 0,
    bindVertexArray: 0,
    samples: [],
  });
  const addGl = (target, source) => {
    for (const key of [
      'bindBuffer', 'bufferData', 'bufferDataBytes', 'bufferSubData',
      'bufferSubDataBytes', 'unallocatedBufferSubData',
      'bufferAllocationProbeErrors', 'createVertexArray', 'bindVertexArray',
    ]) target[key] += source?.[key] || 0;
    for (const sample of source?.samples || []) {
      if (target.samples.length < 32) target.samples.push(sample);
    }
  };
  const glTotal = (byPhase) => {
    const result = makeGl();
    for (const counts of Object.values(byPhase || {})) addGl(result, counts);
    return result;
  };

  const setupOperations = [];
  const timed = (label, callback, target = setupOperations) => {
    const startedAt = performance.now();
    let error = null;
    let value;
    try { value = callback(); }
    catch (caught) { error = caught; throw caught; }
    finally {
      target.push({ label, durationMs: performance.now() - startedAt,
        error: error?.message || null });
    }
    return value;
  };
  const waitFor = async (predicate, label, timeout = 180000) => {
    const deadline = performance.now() + timeout;
    while (!predicate() && performance.now() < deadline) await frame();
    if (!predicate()) {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const warm = g.shaderWarmup;
      const outstanding = (warm?.compileJobs || [])
        .filter((entry) => !Number.isFinite(entry.settledMs))
        .slice(0, 12).map((entry) => entry.label);
      throw new Error(`Stage C dynamics timeout: ${label} -- ${JSON.stringify({
        scenario, act: g.act, generation: g._webglGeneration,
        key: progress?.key || null,
        queues: progress ? {
          current: progress.queue.length, exact: progress.exactQueue.length,
          owner: progress.ownerQueue.length, ownerExact: progress.ownerExactQueue.length,
          deferred: progress.deferredQueue.length,
          deferredExact: progress.deferredExactQueue.length,
          pendingReveal: progress.pendingReducedReveal.length,
        } : null,
        shader: {
          status: warm?.status || null,
          currentExactStatus: warm?.currentExactStatus || null,
          inFlight: g._shaderCompileActivity?.active ?? null,
          label: warm?.compileInFlightLabel || null,
          outstanding,
        },
        lastRender: g.lastRender,
      })}`);
    }
  };
  const step = async (seconds, controls = {}, label = 'step', operations = setupOperations) => {
    timed(label, () => F.stepWith(seconds, controls, false), operations);
    await frame();
  };
  const stepSlices = async (seconds, controls, label, operations, maxSlice = 0.04) => {
    let remaining = seconds;
    let index = 0;
    while (remaining > 0.00001) {
      const slice = Math.min(maxSlice, remaining);
      await step(slice, controls, `${label}-${++index}`, operations);
      remaining -= slice;
    }
  };

  const phaseStack = [];
  const withPhase = (label, callback) => {
    const startedAt = performance.now();
    phaseStack.push(label);
    try { return callback(); } finally {
      phaseStack.pop();
      if (activeFrame) {
        const timing = activeFrame.phaseTimings[label] ||= {
          calls: 0, totalMs: 0, maxMs: 0,
        };
        const durationMs = performance.now() - startedAt;
        timing.calls++;
        timing.totalMs += durationMs;
        timing.maxMs = Math.max(timing.maxMs, durationMs);
      }
    }
  };
  let activeFrame = null;
  let activeDrawObject = null;
  let activeDrawGeometry = null;
  let activeDrawMaterial = null;
  let activeCertificateAttempt = null;
  let activeEpisode = null;
  let previousRaf = null;
  let lastCompletedRender = null;
  let sampling = true;
  let frameSerial = 0;
  const recentFrames = [];
  const outsideGl = makeGl();
  const probeArrays = new WeakMap();
  const probeGeometryMeta = new Map();
  const probeUploads = [];
  const probeVaos = [];
  const probeSubmissions = [];
  const coldVaoEvents = [];
  const actionGeometryMeta = new Map();
  const actionBindingPreloads = [];
  const actionBindingCertificates = [];
  const actionBindingSubmissions = [];
  const actionBindingSubmissionKeys = new Set();
  const observedBatchEntries = [];
  const observedExactEntries = [];
  const observedFinalizePasses = [];
  let batchAudit = { count: 0, failures: [] };
  let exactAudit = { count: 0, failures: [], entries: [] };
  let finalizeAudit = { count: 0, failures: [], incomplete: [], entries: [] };
  const observedResidencyErrors = [];
  const observedShaderErrors = [];
  const traces = [];
  const registerActionGeometry = (root, role) => root?.traverse?.((object) => {
    if (!object?.geometry?.uuid) return;
    actionGeometryMeta.set(object.geometry.uuid, {
      role, objectUuid: object.uuid, geometryUuid: object.geometry.uuid,
    });
  });
  registerActionGeometry(g.flameCircuit?.embers?.[0]?.group, 'carried-flame-shared');
  for (const target of g.world?.fetchTargets || []) {
    if (target?.heldCarry) registerActionGeometry(target.object, `held-carry:${target.id}`);
  }

  const newEpisode = (label) => {
    const residency = g.currentGpuResidency;
    const progress = residency?.progressive;
    const now = performance.now();
    const episode = {
      label,
      act: g.act,
      generation: g._webglGeneration,
      key: progress?.key || null,
      startedAt: now,
      frames: 0,
      rafIntervals: 0,
      renderIntervals: 0,
      maxRenderMs: 0,
      maxRenderStartIntervalMs: 0,
      maxRenderCompletionIntervalMs: 0,
      maxRafTimestampMs: 0,
      maxObservedRafMs: 0,
      stageToFirstObservedRafMs: null,
      slowFrames: [],
      slowRenderIntervals: [],
      timestampJumps: [],
      slowObservedRafs: [],
      samplerOrderingErrors: [],
      boundaryErrors: [],
      visibleResourceFrames: [],
      shieldedFrames: 0,
      glByPhase: {},
      samples: [],
      lastFrame: null,
      operations: [],
      beforeStats: stats(),
      afterStats: null,
      resourceDelta: null,
      beforeFingerprint: null,
      afterFingerprint: null,
      lastRenderStartedAt: null,
      lastRenderCompletedAt: null,
    };
    activeEpisode = episode;
    previousRaf = null;
    return episode;
  };
  const sampleRaf = (timestamp) => {
    const observedAt = performance.now();
    if (activeEpisode && activeEpisode.stageToFirstObservedRafMs == null) {
      activeEpisode.stageToFirstObservedRafMs = observedAt - activeEpisode.startedAt;
    }
    const current = {
      episode: activeEpisode,
      generation: g._webglGeneration,
      timestamp,
      observedAt,
      completedFrameId: lastCompletedRender?.frameId ?? null,
      completedAt: lastCompletedRender?.completedAt ?? null,
      completedEpisode: lastCompletedRender?.episode ?? null,
      completedGeneration: lastCompletedRender?.generation ?? null,
    };
    if (activeEpisode && activeEpisode.generation !== g._webglGeneration
        && activeEpisode.boundaryErrors.length < 16) {
      activeEpisode.boundaryErrors.push({
        phase: 'post-render-sampler',
        episodeGeneration: activeEpisode.generation,
        observedGeneration: g._webglGeneration,
        observedAt,
      });
    }
    const sameBoundary = activeEpisode && previousRaf
      && previousRaf.episode === activeEpisode
      && previousRaf.generation === g._webglGeneration
      && activeEpisode.generation === g._webglGeneration
      && previousRaf.observedAt >= activeEpisode.startedAt
      && observedAt >= activeEpisode.startedAt;
    if (sameBoundary) {
      const timestampIntervalMs = timestamp - previousRaf.timestamp;
      const observedIntervalMs = observedAt - previousRaf.observedAt;
      const previousCallbackLagMs = previousRaf.observedAt - previousRaf.timestamp;
      const currentCallbackLagMs = observedAt - timestamp;
      const algebraResidualMs = timestampIntervalMs
        - (observedIntervalMs + previousCallbackLagMs - currentCallbackLagMs);
      activeEpisode.rafIntervals++;
      activeEpisode.maxRafTimestampMs = Math.max(
        activeEpisode.maxRafTimestampMs, timestampIntervalMs,
      );
      activeEpisode.maxObservedRafMs = Math.max(
        activeEpisode.maxObservedRafMs, observedIntervalMs,
      );
      let diagnostic = null;
      const timingDiagnostic = () => diagnostic || (diagnostic = {
        timestampIntervalMs,
        observedIntervalMs,
        fromCallbackLagMs: previousCallbackLagMs,
        toCallbackLagMs: currentCallbackLagMs,
        algebraResidualMs,
        fromTimestamp: previousRaf.timestamp,
        toTimestamp: timestamp,
        fromObservedAt: previousRaf.observedAt,
        toObservedAt: observedAt,
        recentFrames: clone(recentFrames),
      });
      if (timestampIntervalMs >= 100) {
        activeEpisode.timestampJumps.push(timingDiagnostic());
      }
      if (observedIntervalMs >= 100) {
        activeEpisode.slowObservedRafs.push(timingDiagnostic());
      }
      const completionOrdered = Number.isInteger(previousRaf.completedFrameId)
        && Number.isInteger(current.completedFrameId)
        && current.completedFrameId > previousRaf.completedFrameId
        && previousRaf.completedEpisode === activeEpisode.label
        && current.completedEpisode === activeEpisode.label
        && previousRaf.completedGeneration === activeEpisode.generation
        && current.completedGeneration === activeEpisode.generation
        && previousRaf.completedAt <= previousRaf.observedAt
        && current.completedAt <= current.observedAt;
      if (!completionOrdered) activeEpisode.samplerOrderingErrors.push({
        previous: { ...previousRaf, episode: previousRaf.episode?.label || null },
        current: { ...current, episode: current.episode?.label || null },
      });
    }
    previousRaf = current;
    if (sampling) requestAnimationFrame(sampleRaf);
  };
  requestAnimationFrame(sampleRaf);

  const context = gl;
  const glOriginals = {};
  const glWrappers = {};
  const boundBuffers = new Map();
  const allocatedBuffers = new WeakSet();
  const bufferIds = new WeakMap();
  let nextBufferId = 1;
  const bufferId = (buffer) => {
    if (!buffer) return null;
    if (!bufferIds.has(buffer)) bufferIds.set(buffer, nextBufferId++);
    return bufferIds.get(buffer);
  };
  const currentProgramIdentity = (material) => {
    const program = material ? renderer.properties?.get?.(material)?.currentProgram : null;
    return program ? {
      id: program.id ?? null,
      name: program.name || null,
      type: program.type || null,
      cacheKey: program.cacheKey || null,
    } : null;
  };
  const activeDrawIdentity = () => activeDrawGeometry ? {
    object: activeDrawObject?.name || activeDrawObject?.type || '(unnamed)',
    objectUuid: activeDrawObject?.uuid || null,
    objectType: activeDrawObject?.type || null,
    geometryUuid: activeDrawGeometry?.uuid || null,
    material: activeDrawMaterial?.name || activeDrawMaterial?.type || '(unnamed)',
    materialUuid: activeDrawMaterial?.uuid || null,
    targetUuid: renderer.getRenderTarget?.()?.texture?.uuid || null,
  } : null;
  const programLightSignature = (program) => {
    const parts = `${program?.cacheKey || ''}`.split(',');
    if (parts.length < 53) return null;
    return {
      directional: Number(parts[33]),
      point: Number(parts[34]),
      spot: Number(parts[35]),
      hemisphere: Number(parts[37]),
      directionalShadows: Number(parts[39]),
    };
  };
  const glProgramIdentities = new WeakMap();
  const glProgramIdentity = (handle) => {
    if (!handle) return { id: null, name: null, type: null, cacheKey: null };
    const cached = glProgramIdentities.get(handle);
    if (cached) return cached;
    const program = (renderer.info.programs || []).find((entry) => entry.program === handle);
    const identity = program ? {
      id: program.id ?? null,
      name: program.name || null,
      type: program.type || null,
      cacheKey: program.cacheKey || null,
    } : { id: null, name: null, type: null, cacheKey: null };
    if (program) glProgramIdentities.set(handle, identity);
    return identity;
  };
  // One setup-time query seeds a program that may already be bound before the
  // hooks are installed. Every later switch is observed through useProgram;
  // createVertexArray never pays a synchronous GL query or an O(programs) scan.
  let activeGlProgram = glProgramIdentity(gl.getParameter(gl.CURRENT_PROGRAM));
  const bucket = () => {
    if (!activeFrame) {
      if (activeEpisode) {
        return activeEpisode.glByPhase['async-outside'] ||= makeGl();
      }
      return outsideGl;
    }
    const phase = phaseStack.at(-1) || 'visible-render';
    return activeFrame.phases[phase] ||= makeGl();
  };
  const sampleGl = (counts, method, detail = {}) => {
    if (counts.samples.length < 32) counts.samples.push({
      method,
      generation: g._webglGeneration,
      draw: activeDrawIdentity(),
      ...detail,
    });
  };
  const hookGl = (name, callback) => {
    glOriginals[name] = context[name];
    const wrapper = function stageCDynamicsGlHook(...args) {
      return callback.call(this, glOriginals[name], args);
    };
    glWrappers[name] = wrapper;
    context[name] = wrapper;
    if (context[name] !== wrapper) throw new Error(`could not install GL hook ${name}`);
  };
  hookGl('useProgram', function useProgram(original, args) {
    const result = original.apply(this, args);
    activeGlProgram = glProgramIdentity(args[0]);
    return result;
  });
  hookGl('bindBuffer', function bindBuffer(original, args) {
    const result = original.apply(this, args);
    boundBuffers.set(args[0], args[1]);
    bucket().bindBuffer++;
    return result;
  });
  hookGl('bufferData', function bufferData(original, args) {
    const counts = bucket();
    const buffer = boundBuffers.get(args[0]);
    const bytes = Number.isFinite(args[1]) ? Number(args[1])
      : Number(args[1]?.byteLength || 0);
    counts.bufferData++;
    counts.bufferDataBytes += bytes;
    const meta = args[1] && typeof args[1] === 'object'
      ? probeArrays.get(args[1]) || null : null;
    const detail = { target: args[0], bytes, bufferId: bufferId(buffer), probe: meta };
    sampleGl(counts, 'bufferData', detail);
    if (meta) probeUploads.push({ method: 'bufferData', phase: phaseStack.at(-1)
      || (activeFrame ? 'visible-render' : 'async-outside'), ...clone(meta), bytes,
    draw: activeDrawIdentity() });
    if (buffer) allocatedBuffers.add(buffer);
    return original.apply(this, args);
  });
  hookGl('bufferSubData', function bufferSubData(original, args) {
    const counts = bucket();
    const buffer = boundBuffers.get(args[0]);
    const bytes = Number(args[2]?.byteLength || 0);
    let bufferSizeBefore = null;
    let probeError = null;
    let allocatedBefore = !!buffer && allocatedBuffers.has(buffer);
    if (!allocatedBefore) {
      try {
        bufferSizeBefore = Number(context.getBufferParameter(args[0], context.BUFFER_SIZE));
        allocatedBefore = !!buffer && bufferSizeBefore > 0;
      } catch (error) { probeError = error?.message || `${error}`; }
    }
    if (allocatedBefore && buffer) allocatedBuffers.add(buffer);
    counts.bufferSubData++;
    counts.bufferSubDataBytes += bytes;
    if (!allocatedBefore) counts.unallocatedBufferSubData++;
    if (probeError) counts.bufferAllocationProbeErrors++;
    const meta = args[2] && typeof args[2] === 'object'
      ? probeArrays.get(args[2]) || null : null;
    const detail = { target: args[0], bytes, allocatedBefore,
      bufferSizeBefore, probeError, bufferId: bufferId(buffer), probe: meta };
    sampleGl(counts, 'bufferSubData', detail);
    if (meta) probeUploads.push({ method: 'bufferSubData', phase: phaseStack.at(-1)
      || (activeFrame ? 'visible-render' : 'async-outside'), ...clone(meta), bytes,
    allocatedBefore, draw: activeDrawIdentity() });
    return original.apply(this, args);
  });
  hookGl('createVertexArray', function createVertexArray(original, args) {
    const vao = original.apply(this, args);
    const counts = bucket();
    counts.createVertexArray++;
    const ancestry = [];
    let ancestor = activeDrawObject;
    for (let depth = 0; ancestor && depth < 8; depth++, ancestor = ancestor.parent) {
      ancestry.push({
        name: ancestor.name || ancestor.type || '(unnamed)',
        uuid: ancestor.uuid || null,
        type: ancestor.type || null,
      });
    }
    const coldDraw = activeDrawGeometry ? {
        geometryType: activeDrawGeometry?.type || null,
        materialType: activeDrawMaterial?.type || null,
        program: currentProgramIdentity(activeDrawMaterial),
        activeGlProgram: activeEpisode ? activeGlProgram : null,
        layerMask: activeDrawObject?.layers?.mask ?? null,
        visible: activeDrawObject?.visible ?? null,
        frustumCulled: activeDrawObject?.frustumCulled ?? null,
        userDataKeys: Object.keys(activeDrawObject?.userData || {}).sort(),
        ancestry,
      } : null;
    sampleGl(counts, 'createVertexArray', { coldDraw });
    const phase = phaseStack.at(-1)
      || (activeFrame ? 'visible-render' : activeEpisode ? 'async-outside' : 'outside');
    if (phase === 'visible-render' || phase === 'async-outside') {
      coldVaoEvents.push({
        frameId: activeFrame?.frameId || null,
        episode: activeEpisode?.label || null,
        phase,
        generation: g._webglGeneration,
        fov: g.camera?.fov ?? null,
        draw: activeDrawIdentity(),
        coldDraw,
      });
    }
    const meta = activeDrawGeometry?.uuid
      ? probeGeometryMeta.get(activeDrawGeometry.uuid) || null : null;
    if (meta) probeVaos.push({
      phase: phaseStack.at(-1) || (activeFrame ? 'visible-render' : 'async-outside'),
      ...clone(meta),
      draw: activeDrawIdentity(),
      frameId: activeFrame?.frameId || null,
    });
    return vao;
  });
  hookGl('bindVertexArray', function bindVertexArray(original, args) {
    bucket().bindVertexArray++;
    return original.apply(this, args);
  });
  const trace = {
    installed: Object.entries(glWrappers).every(([name, wrapper]) => context[name] === wrapper),
    healthyAtRestore: null,
    healthy: () => Object.entries(glWrappers).every(([name, wrapper]) =>
      context[name] === wrapper),
    restore() {
      this.healthyAtRestore = this.healthy();
      for (const [name, original] of Object.entries(glOriginals)) context[name] = original;
    },
  };
  traces.push(trace);

  const realRenderBufferDirect = renderer.renderBufferDirect;
  renderer.renderBufferDirect = function tracedDynamicsRenderBufferDirect(
    camera, scene, geometry, material, object, group,
  ) {
    const previousObject = activeDrawObject;
    const previousGeometry = activeDrawGeometry;
    const previousMaterial = activeDrawMaterial;
    activeDrawObject = object;
    activeDrawGeometry = geometry;
    activeDrawMaterial = material;
    const actionMeta = actionGeometryMeta.get(geometry?.uuid);
    try {
      return realRenderBufferDirect.call(this, camera, scene, geometry, material, object, group);
    } finally {
      const phase = phaseStack.at(-1) || (activeFrame ? 'visible-render' : 'async-outside');
      if (actionMeta && (phase === 'exact-certificate'
          || (phase === 'visible-render' && activeEpisode))) {
        const subpass = camera === g.grainCam ? 'grain'
          : (camera?.layers?.mask & 1) !== 0 ? 'world' : 'held';
        const binding = {
          generation: g._webglGeneration,
          subpass,
          frameId: activeFrame?.frameId || null,
          role: actionMeta.role,
          objectUuid: object?.uuid || null,
          geometryUuid: geometry.uuid,
          materialUuid: material?.uuid || null,
          materialType: material?.type || null,
          layerMask: object?.layers?.mask ?? null,
          targetUuid: renderer.getRenderTarget?.()?.texture?.uuid || null,
          cameraUuid: camera?.uuid || null,
          cameraMask: camera?.layers?.mask ?? null,
          program: currentProgramIdentity(material),
        };
        if (phase === 'exact-certificate') {
          actionBindingCertificates.push({
            ...binding,
            certificateGeneration: activeCertificateAttempt?.generation ?? null,
            certificateKey: activeCertificateAttempt?.key || null,
            certificateRevision: activeCertificateAttempt?.revision ?? null,
            proofKey: activeCertificateAttempt?.proofKey || null,
          });
        } else {
          const submissionKey = [
            activeEpisode.label, binding.geometryUuid, binding.materialUuid,
            subpass, binding.program?.id, binding.targetUuid,
          ].join('|');
          if (!actionBindingSubmissionKeys.has(submissionKey)) {
            actionBindingSubmissionKeys.add(submissionKey);
            actionBindingSubmissions.push({ ...binding, episode: activeEpisode.label });
          }
        }
      }
      activeDrawObject = previousObject;
      activeDrawGeometry = previousGeometry;
      activeDrawMaterial = previousMaterial;
    }
  };

  let pauseDeferred = false;
  let pausedDeferredCalls = 0;
  const realBatch = g._submitReducedWorldBatch;
  g._submitReducedWorldBatch = function tracedDynamicsBatch(progress, options = {}) {
    if (pauseDeferred && options.deferredOnly) {
      pausedDeferredCalls++;
      return null;
    }
    const label = options.exactOnly
      ? options.ownerOnly ? 'owner-exact-preload'
        : options.deferredOnly ? 'deferred-exact-preload' : 'current-exact-preload'
      : options.ownerOnly ? 'owner-reduced-preload'
        : options.deferredOnly ? 'deferred-reduced-preload' : 'reduced-preload';
    const entry = withPhase(label, () => realBatch.call(this, progress, options));
    if (entry) observedBatchEntries.push(entry);
    if (entry?.identity?.sources?.length) {
      for (const source of entry.identity.sources) {
        const meta = actionGeometryMeta.get(source.geometryUuid);
        if (!meta) continue;
        const object = progress?.exactObjects?.get(source.entryKey)?.object || null;
        const materials = Array.isArray(object?.material) ? object.material : [object?.material];
        actionBindingPreloads.push({
          generation: g._webglGeneration,
          kind: entry.kind,
          key: entry.key,
          batch: entry.batch,
          committed: entry.committed === true,
          error: entry.error || null,
          rig: entry.rig || null,
          targetOwner: entry.targetOwner || null,
          targetUuid: entry.targetUuid || null,
          role: meta.role,
          objectUuid: source.objectUuid,
          geometryUuid: source.geometryUuid,
          entryKey: source.entryKey,
          programs: materials.filter(Boolean).map((material) => ({
            materialUuid: material.uuid,
            materialType: material.type,
            program: currentProgramIdentity(material),
          })),
        });
      }
    }
    return entry;
  };
  const realExact = g._submitExactCurrentPass;
  g._submitExactCurrentPass = function tracedDynamicsExact(options) {
    const progress = g.currentGpuResidency?.progressive;
    const revision = progress?.exactShaderRevision ?? 0;
    const previousAttempt = activeCertificateAttempt;
    activeCertificateAttempt = {
      generation: g._webglGeneration,
      key: options?.key || null,
      revision,
      proofKey: `${options?.key || ''}|${revision}`,
    };
    const certificateStart = actionBindingCertificates.length;
    let entry = null;
    try {
      entry = withPhase('exact-certificate', () => realExact.call(this, options));
      if (entry) observedExactEntries.push(entry);
      return entry;
    } finally {
      for (let index = certificateStart; index < actionBindingCertificates.length; index++) {
        actionBindingCertificates[index].certificateCommitted = entry?.committed === true
          && entry.error == null;
        actionBindingCertificates[index].certificateError = entry?.error || null;
      }
      activeCertificateAttempt = previousAttempt;
    }
  };
  const realOwner = g._prepareOwnerGpuResidency;
  g._prepareOwnerGpuResidency = function tracedDynamicsOwner(kind) {
    return withPhase(`${kind}-owner-certificate`, () => realOwner.call(this, kind));
  };
  const realRender = g.render;
  g.render = function measuredDynamicsRender(...args) {
    const before = stats();
    const residencyBefore = g.currentGpuResidency;
    const exactBefore = residencyBefore?.exactPasses?.length || 0;
    const ownerBefore = residencyBefore?.ownerPasses?.length || 0;
    const finalizeBefore = residencyBefore?.universeFinalizePasses?.length || 0;
    const row = activeFrame = {
      frameId: ++frameSerial,
      episode: activeEpisode?.label || 'unowned',
      act: g.act,
      generation: g._webglGeneration,
      startedAt: performance.now(),
      phases: {},
      phaseTimings: {},
    };
    try { return withPhase('visible-render', () => realRender.apply(this, args)); }
    finally {
      row.renderCompletedAt = performance.now();
      row.renderMs = row.renderCompletedAt - row.startedAt;
      lastCompletedRender = {
        frameId: row.frameId,
        episode: row.episode,
        generation: row.generation,
        completedAt: row.renderCompletedAt,
      };
      const after = stats();
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      row.worldDrawCalls = g.lastRender?.worldDrawCalls || 0;
      row.reducedDetail = !!g.lastRender?.reducedDetail;
      row.shielded = !!g._shaderTransitionShield;
      row.visibleProgramDelta = g.lastRender?.visibleProgramDelta || 0;
      row.visibleTextureDelta = g.lastRender?.visibleTextureDelta || 0;
      row.visibleGeometryDelta = g.lastRender?.visibleGeometryDelta || 0;
      row.rawDelta = deltaStats(before, after);
      row.exactPassDelta = (residency?.exactPasses?.length || 0) - exactBefore;
      row.ownerPassDelta = (residency?.ownerPasses?.length || 0) - ownerBefore;
      row.key = progress?.key || null;
      row.queues = progress ? {
        reduced: progress.queue.length, exact: progress.exactQueue.length,
        owner: progress.ownerQueue.length, ownerExact: progress.ownerExactQueue.length,
        deferred: progress.deferredQueue.length,
        deferredExact: progress.deferredExactQueue.length,
        pendingReveal: progress.pendingReducedReveal.length,
      } : null;
      row.shader = {
        status: g.shaderWarmup?.status || null,
        currentExactStatus: g.shaderWarmup?.currentExactStatus || null,
        inFlight: g._shaderCompileActivity?.active ?? null,
        label: g.shaderWarmup?.compileInFlightLabel || null,
      };
      const finalizeStart = residency === residencyBefore ? finalizeBefore : 0;
      for (const entry of (residency?.universeFinalizePasses || []).slice(finalizeStart)) {
        observedFinalizePasses.push({
          ...entry,
          frameId: row.frameId,
          renderMs: row.renderMs,
          worldDrawCalls: row.worldDrawCalls,
          reducedDetail: row.reducedDetail,
          phaseTimings: clone(row.phaseTimings),
        });
      }
      if (activeEpisode) {
        const episode = activeEpisode;
        episode.frames++;
        episode.maxRenderMs = Math.max(episode.maxRenderMs, row.renderMs);
        if (row.renderMs >= 100) episode.slowFrames.push(clone(row));
        const generationOwned = row.generation === episode.generation
          && row.episode === episode.label;
        if (!generationOwned && episode.boundaryErrors.length < 16) {
          episode.boundaryErrors.push({
            phase: 'measured-render',
            episodeGeneration: episode.generation,
            rowGeneration: row.generation,
            episode: episode.label,
            rowEpisode: row.episode,
            frameId: row.frameId,
          });
        }
        if (generationOwned && episode.lastRenderStartedAt != null
            && episode.lastRenderCompletedAt != null) {
          const startIntervalMs = row.startedAt - episode.lastRenderStartedAt;
          const completionIntervalMs = row.renderCompletedAt - episode.lastRenderCompletedAt;
          episode.renderIntervals++;
          episode.maxRenderStartIntervalMs = Math.max(
            episode.maxRenderStartIntervalMs, startIntervalMs,
          );
          episode.maxRenderCompletionIntervalMs = Math.max(
            episode.maxRenderCompletionIntervalMs, completionIntervalMs,
          );
          if (startIntervalMs >= 100 || completionIntervalMs >= 100) {
            episode.slowRenderIntervals.push({
              frameId: row.frameId,
              startIntervalMs,
              completionIntervalMs,
              renderMs: row.renderMs,
              recentFrames: clone(recentFrames),
            });
          }
        }
        if (generationOwned) {
          episode.lastRenderStartedAt = row.startedAt;
          episode.lastRenderCompletedAt = row.renderCompletedAt;
        }
        if (row.shielded) episode.shieldedFrames++;
        if (row.worldDrawCalls > 0 && (row.visibleProgramDelta !== 0
            || row.visibleTextureDelta !== 0 || row.visibleGeometryDelta !== 0)) {
          episode.visibleResourceFrames.push(clone(row));
        }
        for (const [phase, counts] of Object.entries(row.phases)) {
          episode.glByPhase[phase] ||= makeGl();
          addGl(episode.glByPhase[phase], counts);
        }
        const cold = glTotal(row.phases);
        if (episode.samples.length < 6 || row.renderMs >= 80
            || row.exactPassDelta || row.ownerPassDelta
            || row.visibleProgramDelta || row.visibleTextureDelta
            || row.visibleGeometryDelta || cold.bufferData || cold.createVertexArray
            || cold.unallocatedBufferSubData || cold.bufferAllocationProbeErrors) {
          episode.samples.push(clone(row));
        }
        episode.lastFrame = clone(row);
      }
      recentFrames.push({
        frameId: row.frameId,
        episode: row.episode,
        act: row.act,
        generation: row.generation,
        startedAt: row.startedAt,
        renderMs: row.renderMs,
        worldDrawCalls: row.worldDrawCalls,
        reducedDetail: row.reducedDetail,
        exactPassDelta: row.exactPassDelta,
        ownerPassDelta: row.ownerPassDelta,
        key: row.key,
        queues: row.queues,
        shader: row.shader,
        phaseTimings: row.phaseTimings,
      });
      if (recentFrames.length > 16) recentFrames.shift();
      activeFrame = null;
    }
  };
  const measuredRender = g.render;

  const fingerprint = () => {
    const residency = g.currentGpuResidency;
    const progress = residency?.progressive;
    return {
      generation: g._webglGeneration,
      activeKey: residency?.activeKey || null,
      key: progress?.key || null,
      skullWorldReadyKey: residency?.skullWorldReadyKey || null,
      exactShaderRevision: progress?.exactShaderRevision ?? null,
      universes: progress ? {
        current: progress.exactUniverse.size,
        currentCovered: progress.exactCovered.size,
        owner: progress.ownerUniverse.size,
        ownerCovered: progress.ownerCovered.size,
        ownerExact: progress.ownerExactUniverse.size,
        ownerExactCovered: progress.ownerExactCovered.size,
        deferred: progress.deferredUniverse.size,
        deferredCovered: progress.deferredCovered.size,
        deferredExact: progress.deferredExactUniverse.size,
        deferredExactCovered: progress.deferredExactCovered.size,
      } : null,
      queues: progress ? {
        reduced: progress.queue.length, exact: progress.exactQueue.length,
        owner: progress.ownerQueue.length, ownerExact: progress.ownerExactQueue.length,
        deferred: progress.deferredQueue.length,
        deferredExact: progress.deferredExactQueue.length,
        pendingReveal: progress.pendingReducedReveal.length,
      } : null,
      passes: residency ? {
        snapshot: residency.snapshotPasses.length,
        reduced: residency.reducedPasses.length,
        exactPreload: residency.exactPreloadPasses.length,
        exact: residency.exactPasses.length,
        owner: residency.ownerPasses.length,
        skullWorld: residency.skullWorldPasses.length,
      } : null,
      errors: residency?.errors?.length || 0,
    };
  };
  const finishEpisode = async (episode) => {
    await frame();
    await frame();
    episode.afterStats = stats();
    episode.resourceDelta = deltaStats(episode.beforeStats, episode.afterStats);
    episode.afterFingerprint = fingerprint();
    activeEpisode = null;
    previousRaf = null;
    return episode;
  };
  const residencyPhysicalReady = () => {
    const residency = g.currentGpuResidency;
    const progress = residency?.progressive;
    const expectedKey = g._currentGpuResidencyKey();
    return !!progress && residency.generation === g._webglGeneration
      && residency.activeKey === expectedKey && progress.key === expectedKey
      && residency.physical.has(expectedKey)
      && progress.exactQueue.length === 0
      && progress.pendingReducedReveal.length === 0
      && !g.lastRender?.reducedDetail
      && (g.lastRender?.worldDrawCalls || 0) > 0
      && !g._shaderTransitionShield;
  };
  const residencyQuiescent = () => {
    const residency = g.currentGpuResidency;
    const progress = residency?.progressive;
    if (!residencyPhysicalReady() || !progress) return false;
    const ownerComplete = progress.ownerUniverse.size === 0
      || (progress.ownerQueue.length === 0 && progress.ownerExactQueue.length === 0
        && progress.ownerRecorded && progress.ownerExactRecorded);
    const deferredComplete = !progress.deferredLabel
      || (progress.deferredQueue.length === 0 && progress.deferredExactQueue.length === 0
        && progress.deferredRecorded && progress.deferredExactRecorded);
    return ownerComplete && deferredComplete
      && progress.queue.length === 0 && progress.exactQueue.length === 0
      && residency.skullWorldReadyKey === `${progress.key}|${progress.exactShaderRevision}`
      && progress.failedObjects.size === 0 && progress.failedOwners.size === 0
      && progress.failedDeferred.size === 0 && !progress.blockedCritical
      && g.shaderWarmup?.status === 'ready'
      && g.shaderWarmup?.currentExactStatus === 'ready'
      && g.shaderWarmup?.currentExactKey === progress.key
      && g.shaderWarmup?.currentExactRevision === progress.exactShaderRevision
      && (g._shaderCompileActivity?.active || 0) === 0;
  };
  const actionGeometryRows = (root) => {
    const rows = [];
    root?.traverse?.((object) => {
      if ((!object?.isMesh && !object?.isLine && !object?.isPoints)
          || !object.geometry || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      rows.push({
        objectUuid: object.uuid,
        geometryUuid: object.geometry.uuid,
        materialUuids: materials.filter(Boolean).map((material) => material.uuid).sort(),
      });
    });
    return rows;
  };
  const assertHeldCarryBindings = () => {
    const expected = [];
    for (const target of g.world?.fetchTargets || []) {
      if (!target?.heldCarry || !target.object) continue;
      for (const row of actionGeometryRows(target.object)) {
        expected.push({ target: target.id, ...row });
      }
    }
    const missing = [];
    const progress = g.currentGpuResidency?.progressive;
    for (const expectedRow of expected) {
      for (const rig of ['world', 'held']) {
        const matched = actionBindingPreloads.some((entry) =>
          entry.kind === 'current-exact-preload-batch'
          && entry.committed && entry.error == null
          && entry.generation === g._webglGeneration && entry.key === progress?.key
          && entry.targetUuid == null && entry.rig === rig
          && entry.objectUuid === expectedRow.objectUuid
          && entry.geometryUuid === expectedRow.geometryUuid);
        if (!matched) missing.push({ ...expectedRow, rig });
      }
    }
    assert(expected.length > 0 && missing.length === 0,
      'every finite held carry earns committed world and held default-target bindings',
      { expected, missing });
  };
  const assertCarriedFlameBindings = (kind) => {
    const ember0 = actionGeometryRows(g.flameCircuit?.embers?.[0]?.group);
    const ember1 = actionGeometryRows(g.flameCircuit?.embers?.[1]?.group);
    const bindingTuples = (rows) => [...new Set(rows.map((row) =>
      `${row.geometryUuid}|${row.materialUuids.join(',')}`))].sort();
    const shared0 = bindingTuples(ember0);
    const shared1 = bindingTuples(ember1);
    assert(ember0.length === 3 && ember1.length === 3 && shared0.length === 3
      && JSON.stringify(shared0) === JSON.stringify(shared1),
    `${kind} uses two production ember sockets with exactly three shared bindings`, {
      ember0, ember1, shared0, shared1,
    });
    const expected = ember0;
    const residency = g.currentGpuResidency;
    const progress = residency?.progressive;
    const proofKey = `${progress?.key || ''}|${progress?.exactShaderRevision ?? 0}`;
    const missingPreloads = [];
    const missingCertificates = [];
    const wrongSignatures = [];
    const proofs = [];
    const expectedSignature = (rig) => rig === 'world'
      ? { directional: 1, point: 16, spot: 1, hemisphere: 1, directionalShadows: 1 }
      : { directional: 0, point: 2, spot: 0, hemisphere: 0, directionalShadows: 0 };
    const signatureMatches = (program, rig) => JSON.stringify(programLightSignature(program))
      === JSON.stringify(expectedSignature(rig));
    for (const expectedRow of expected) {
      const rigProof = {};
      for (const rig of ['world', 'held']) {
        const matched = actionBindingPreloads.find((entry) =>
          entry.kind === 'current-exact-preload-batch'
          && entry.committed && entry.error == null
          && entry.generation === g._webglGeneration && entry.key === progress?.key
          && entry.targetUuid == null && entry.rig === rig
          && entry.geometryUuid === expectedRow.geometryUuid
          && entry.programs.some((row) => expectedRow.materialUuids.includes(row.materialUuid)
            && row.program?.id != null && !!row.program?.cacheKey
            && signatureMatches(row.program, rig)));
        if (!matched) missingPreloads.push({ ...expectedRow, rig });
        else {
          rigProof[`${rig}Preload`] = matched.programs.find((row) =>
            expectedRow.materialUuids.includes(row.materialUuid)
              && signatureMatches(row.program, rig));
        }
        const certified = actionBindingCertificates.find((entry) =>
          entry.geometryUuid === expectedRow.geometryUuid
          && expectedRow.materialUuids.includes(entry.materialUuid)
          && entry.certificateGeneration === g._webglGeneration
          && entry.certificateKey === progress?.key
          && entry.certificateRevision === progress?.exactShaderRevision
          && entry.proofKey === proofKey && entry.certificateCommitted === true
          && entry.certificateError == null && entry.subpass === rig
          && entry.targetUuid == null && entry.cameraUuid === g.camera.uuid
          && (rig === 'world'
            ? (entry.cameraMask & 1) !== 0 && entry.layerMask === 1
            : (entry.cameraMask & 1) === 0 && entry.layerMask === 4)
          && entry.program?.id != null && !!entry.program?.cacheKey);
        if (!certified) missingCertificates.push({ ...expectedRow, rig });
        else if (!signatureMatches(certified.program, rig)) {
          wrongSignatures.push({
            ...expectedRow, rig, program: certified.program,
            actual: programLightSignature(certified.program),
            expected: expectedSignature(rig),
          });
        } else rigProof[rig] = certified;
      }
      if (rigProof.world && rigProof.held) {
        if (rigProof.world.program.id === rigProof.held.program.id
            || rigProof.world.program.cacheKey === rigProof.held.program.cacheKey) {
          wrongSignatures.push({
            ...expectedRow,
            error: 'world and held resolved to the same WebGLProgram',
            world: rigProof.world.program,
            held: rigProof.held.program,
          });
        }
        for (const rig of ['world', 'held']) {
          const preload = rigProof[`${rig}Preload`]?.program;
          const certificate = rigProof[rig].program;
          if (!preload || preload.id !== certificate.id
              || preload.cacheKey !== certificate.cacheKey) {
            wrongSignatures.push({
              ...expectedRow, rig,
              error: 'exact preload and actual certificate selected different programs',
              preload: preload || null,
              certificate,
            });
          }
        }
        proofs.push({ expected: expectedRow, world: rigProof.world, held: rigProof.held });
      }
    }
    assert(expected.length > 0 && missingPreloads.length === 0
      && missingCertificates.length === 0 && wrongSignatures.length === 0
      && proofs.length === expected.length,
    `${kind} carried flame has exact P16-world and P2-held preload/certificate bindings`, {
      expected, missingPreloads, missingCertificates, wrongSignatures, proofs,
    });
    return { expected, proofs };
  };
  const assertCarriedFlameActionBindings = (kind, episode, certificateProof) => {
    const missing = [];
    const wrong = [];
    for (const proof of certificateProof.proofs) {
      for (const rig of ['world', 'held']) {
        const certificate = proof[rig];
        const submission = actionBindingSubmissions.find((entry) =>
          entry.episode === episode.label && entry.subpass === rig
          && entry.targetUuid == null
          && entry.geometryUuid === proof.expected.geometryUuid
          && proof.expected.materialUuids.includes(entry.materialUuid));
        if (!submission) {
          missing.push({ ...proof.expected, rig });
          continue;
        }
        const signature = programLightSignature(submission.program);
        const certificateSignature = programLightSignature(certificate.program);
        if (submission.program?.id !== certificate.program?.id
            || submission.program?.cacheKey !== certificate.program?.cacheKey
            || JSON.stringify(signature) !== JSON.stringify(certificateSignature)) {
          wrong.push({
            ...proof.expected, rig,
            certificate: certificate.program,
            submission: submission.program,
            certificateSignature,
            submissionSignature: signature,
          });
        }
      }
    }
    assert(missing.length === 0 && wrong.length === 0,
      `${kind} visible theft and catch reuse the exact certified world/held programs`, {
        missing, wrong,
        submissions: actionBindingSubmissions.filter((entry) => entry.episode === episode.label),
      });
  };
  const assertEpisodeTiming = (episode, label = episode.label) => {
    assert(episode.frames > 0 && episode.maxRenderMs < 100
      && episode.slowFrames.length === 0,
    `${label} owns at least one render and every render is strictly sub-100ms`, {
      frames: episode.frames, maxRenderMs: episode.maxRenderMs,
      slowFrames: episode.slowFrames,
    });
    assert(episode.renderIntervals > 0
      && episode.maxRenderStartIntervalMs < 100
      && episode.maxRenderCompletionIntervalMs < 100
      && episode.slowRenderIntervals.length === 0
      && episode.boundaryErrors.length === 0,
    `${label} owns strictly sub-100ms render-start and paint-ready completion cadence`, {
      renderIntervals: episode.renderIntervals,
      maxRenderStartIntervalMs: episode.maxRenderStartIntervalMs,
      maxRenderCompletionIntervalMs: episode.maxRenderCompletionIntervalMs,
      slowRenderIntervals: episode.slowRenderIntervals,
      boundaryErrors: episode.boundaryErrors,
    });
    assert(episode.rafIntervals > 0 && episode.maxObservedRafMs < 100
      && episode.slowObservedRafs.length === 0
      && episode.samplerOrderingErrors.length === 0
      && episode.boundaryErrors.length === 0,
    `${label} owns at least one ordered post-render callback interval and every observed interval is strictly sub-100ms`, {
      rafIntervals: episode.rafIntervals,
      maxObservedRafMs: episode.maxObservedRafMs,
      slowObservedRafs: episode.slowObservedRafs,
      samplerOrderingErrors: episode.samplerOrderingErrors,
      boundaryErrors: episode.boundaryErrors,
      maxRafTimestampMs: episode.maxRafTimestampMs,
      timestampJumps: episode.timestampJumps,
    });
    assert(episode.stageToFirstObservedRafMs != null
      && episode.stageToFirstObservedRafMs < 100,
    `${label} reaches its first observed paint strictly below 100ms`,
    episode.stageToFirstObservedRafMs);
    assert(episode.operations.every((entry) => entry.error == null
      && entry.durationMs < 100),
    `${label} owns only clean strict sub-100ms synchronous simulation slices`,
    episode.operations);
    assert(episode.shieldedFrames === 0,
      `${label} never substitutes a shader shield`, episode.shieldedFrames);
  };
  const assertActionColdFree = (episode) => {
    const total = glTotal(episode.glByPhase);
    assert(episode.resourceDelta.programs === 0 && episode.resourceDelta.textures === 0
      && episode.resourceDelta.geometries === 0,
    `${episode.label} changes no renderer program, texture, or geometry count`,
    episode.resourceDelta);
    assert(episode.visibleResourceFrames.length === 0,
      `${episode.label} has no visible resource delta`, episode.visibleResourceFrames);
    assert(total.bufferData === 0 && total.createVertexArray === 0
      && total.unallocatedBufferSubData === 0
      && total.bufferAllocationProbeErrors === 0,
    `${episode.label} performs no cold buffer/VAO work or unallocated subdata`, total);
    assert(JSON.stringify(episode.beforeFingerprint)
      === JSON.stringify(episode.afterFingerprint)
      && episode.afterFingerprint?.errors === 0,
    `${episode.label} does not hide action work behind recertification`, {
      before: episode.beforeFingerprint,
      after: episode.afterFingerprint,
    });
    assertEpisodeTiming(episode);
  };
  const aimAt = (target) => {
    const dx = target.x - g.player.pos.x;
    const dy = target.y - (g.player.pos.y + 1.62);
    const dz = target.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.max(-1.3, Math.min(1.3,
      Math.atan2(dy, Math.max(0.001, Math.hypot(dx, dz)))));
    g.player._sync(0);
  };
  const placePlayer = (x, y, z) => {
    g.player.pos.set(x, y, z);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
  };
  const targetPoint = (target) => target.object
    ? target.object.getWorldPosition(g.player.pos.clone()) : target.pos.clone();
  const sweptRecord = (target, skull, at, directive = null) => {
    const point = targetPoint(target);
    const segment = skull.pos.clone().sub(skull.prevPos);
    const length = segment.length();
    const toTarget = point.clone().sub(skull.prevPos);
    const projection = length > 0.0001
      ? Math.max(0, Math.min(1, toTarget.dot(segment) / (length * length))) : 0;
    const recomputed = skull.prevPos.clone().addScaledVector(segment, projection);
    return {
      mode: skull.mode,
      previous: skull.prevPos.toArray(),
      current: skull.pos.toArray(),
      supplied: at?.toArray?.() || null,
      target: point.toArray(),
      radius: target.radius || 0.5,
      segmentLength: length,
      recomputedDistance: recomputed.distanceTo(point),
      suppliedDistance: at?.distanceTo?.(point) ?? null,
      directive,
    };
  };
  const completeCatchRecords = [];
  const realCompleteCatch = g.skull._completeCatch;
  g.skull._completeCatch = function tracedNaturalCatch(ctx, hard) {
    const before = { hard: !!hard, returnTime: this.returnTime,
      returnStuck: this.returnStuck };
    const result = realCompleteCatch.call(this, ctx, hard);
    completeCatchRecords.push({ ...before, mode: this.mode,
      parent: this.root.parent?.uuid || null,
      catchFx: this._catchFx ? { t: this._catchFx.t, dur: this._catchFx.dur } : null });
    return result;
  };
  const waitNaturalCatch = async (episode, label, startCount) => {
    for (let index = 0; index < 240 && g.skull.mode !== 'held'; index++) {
      await step(1 / 60, {}, `${label}-return-${index + 1}`, episode.operations);
    }
    require(g.skull.mode === 'held', `${label} returns naturally before the bounded timeout`, {
      mode: g.skull.mode, state: g.skull.getState(),
    });
    const records = completeCatchRecords.slice(startCount);
    require(records.length === 1, `${label} completes exactly one catch`, records);
    return records[0];
  };
  const installTargetTrace = (target, records) => {
    const original = target.onHit;
    target.onHit = function tracedProductionTarget(skull, at, ctx) {
      const row = sweptRecord(target, skull, at);
      const directive = original.call(this, skull, at, ctx);
      row.directive = directive || null;
      records.push(row);
      return directive;
    };
    return () => { target.onHit = original; };
  };
  const installAllTargetTrace = (records) => {
    const originals = [];
    for (const target of g.world.fetchTargets || []) {
      if (typeof target?.onHit !== 'function') continue;
      const original = target.onHit;
      target.onHit = function tracedAnyProductionTarget(skull, at, ctx) {
        const row = sweptRecord(target, skull, at);
        const directive = original.call(this, skull, at, ctx);
        row.id = target.id || null;
        row.directive = directive || null;
        records.push(row);
        return directive;
      };
      originals.push([target, original]);
    }
    return () => {
      for (const [target, original] of originals) target.onHit = original;
    };
  };
  const flameState = () => ({
    ateFlame: g.flags.has('ateFlame'),
    carriedFlameVisible: g.flags.has('carriedFlameVisible'),
    source: g.flameCircuit?.source || null,
    sources: (g.flameCircuit?.sources || []).map((source) => ({
      id: source.id,
      targetEnabled: !!source.target?.enabled,
      partsVisible: (source.parts || (source.flame ? [source.flame] : []))
        .map((part) => !!part.visible),
      glowIntensity: source.glow?.intensity ?? null,
      inCandles: g.world.candles.includes(source.glow),
      poolOwners: g.world.candlePool.filter((light) => light.userData.c === source.glow).length,
    })),
    transfer: {
      active: g.flameCircuit?.transferActive,
      complete: g.flameCircuit?.transferComplete,
      frames: g.flameCircuit?.transferFrames,
      sparkIterations: g.flameCircuit?.sparkIterations,
      embers: g.flameCircuit?.embers?.length,
      emberActive: g.flameCircuit?.embers?.filter((ember) =>
        ember.group.visible && ember.group.scale.length() > 0).length,
      sparks: g.flameCircuit?.transferSparks?.length,
      visibleSparks: g.flameCircuit?.transferSparks?.filter((spark) => spark.visible).length,
    },
  });

  const episodes = [];
  const districtCases = [];
  const actionOutcomes = {};
  const cleanup = [];

  const runActionThrow = async () => {
    await waitFor(residencyQuiescent, 'settled bedroom before ordinary throw');
    assertHeldCarryBindings();
    const episode = newEpisode('ordinary-press-hold-release-catch');
    episode.beforeFingerprint = fingerprint();
    const catchStart = completeCatchRecords.length;
    const targetHits = [];
    const restoreTargets = installAllTargetTrace(targetHits);
    cleanup.push(restoreTargets);
    const targetEnabledBefore = g.world.fetchTargets
      .filter((target) => target.enabled).map((target) => target.id).sort();
    await step(1 / 120, { throwPressed: true, throwHeld: true },
      'ordinary-throw-press', episode.operations);
    await stepSlices(0.12, { throwHeld: true }, 'ordinary-throw-hold', episode.operations);
    const outbound = {
      mode: g.skull.mode,
      parent: g.skull.root.parent?.uuid || null,
      scene: g.scene.uuid,
      flightTime: g.skull.flightTime,
      layerMasks: [],
    };
    g.skull.root.traverse((object) => { if (!object.isLight) outbound.layerMasks.push(object.layers.mask); });
    await step(1 / 120, { throwReleased: true, throwHeld: false },
      'ordinary-throw-release', episode.operations);
    const release = { mode: g.skull.mode, snapReturn: g.skull.snapReturn };
    const caught = await waitNaturalCatch(episode, 'ordinary throw', catchStart);
    const held = {
      mode: g.skull.mode,
      parent: g.skull.root.parent?.uuid || null,
      hold: g.skull.hold.uuid,
      tetherVisible: !!g.skull.tether.visible,
      hitStop: g.hitStop,
      fovKick: g.fovKick,
      catchFx: g.skull._catchFx ? { t: g.skull._catchFx.t, dur: g.skull._catchFx.dur } : null,
      layerMasks: [],
    };
    g.skull.root.traverse((object) => { if (!object.isLight) held.layerMasks.push(object.layers.mask); });
    await stepSlices(0.32, {}, 'ordinary-catch-settle', episode.operations);
    const settled = { catchFx: !!g.skull._catchFx, root: g.skull.root.position.toArray() };
    const targetEnabledAfter = g.world.fetchTargets
      .filter((target) => target.enabled).map((target) => target.id).sort();
    restoreTargets();
    episode.afterFingerprint = fingerprint();
    await finishEpisode(episode);
    const outcome = { outbound, release, caught, held, settled,
      targetHits, targetEnabledBefore, targetEnabledAfter };
    actionOutcomes.ordinaryThrow = outcome;
    assert(outbound.mode === 'outbound' && outbound.parent === outbound.scene
      && outbound.flightTime > 0 && outbound.layerMasks.every((mask) => mask === 1),
    'press plus hold launches the real skull into the world layer', outbound);
    assert(release.mode === 'returning' && release.snapReturn === true,
      'release begins the real snap return on the next fixed step', release);
    assert(caught.hard === false && caught.returnTime < F.feelProfile.returnFallback
      && caught.catchFx != null && caught.parent === g.skull.hold.uuid,
    'ordinary throw earns one non-failsafe catch with the authored settle', caught);
    assert(held.mode === 'held' && held.parent === held.hold && !held.tetherVisible
      && held.hitStop <= 0 && held.fovKick > 0
      && held.layerMasks.every((mask) => mask === 1 << 2),
    'natural catch restores the held rig without freezing input', held);
    assert(!settled.catchFx && Math.hypot(settled.root[0], settled.root[1],
      settled.root[2] - 0.02) < 0.0001,
    'catch settle ends at the exact calibrated cradle', settled);
    assert(targetHits.length === 0,
      'an empty ordinary throw invokes no production fetch target', outcome);
    assertActionColdFree(episode);
    episodes.push(episode);
  };

  const runTreeKey = async () => {
    const treeKey = g.world.fetchTargets.find((target) => target.id === 'treeKey');
    require(treeKey?.enabled, 'bedroom tree key is available for the real throw');
    placePlayer(7.2, 3.6, 4.6);
    aimAt(targetPoint(treeKey));
    await waitFor(residencyQuiescent, 'settled bedroom sightline before tree key');
    const hits = [];
    const restoreTarget = installTargetTrace(treeKey, hits);
    const episode = newEpisode('tree-key-real-swept-carry');
    episode.beforeFingerprint = fingerprint();
    const catchStart = completeCatchRecords.length;
    try {
      await step(1 / 120, { throwPressed: true, throwHeld: true },
        'tree-key-press', episode.operations);
      for (let index = 0; index < 180 && !g.flags.has('gotBedroomKey'); index++) {
        await step(1 / 120, { throwHeld: true },
          `tree-key-flight-${index + 1}`, episode.operations);
      }
      require(g.flags.has('gotBedroomKey'), 'tree key is acquired by the bounded real flight', {
        skull: g.skull.getState(), hits,
      });
      const acquired = {
        targetEnabled: treeKey.enabled,
        carryId: g.skull.carry?.id || null,
        carryParent: g.skull.carry?.mesh?.parent?.uuid || null,
        jawMount: g.skull.jawMount.uuid,
        carryScale: g.skull.carry?.mesh?.scale?.x ?? null,
        mode: g.skull.mode,
      };
      const caught = await waitNaturalCatch(episode, 'tree key', catchStart);
      episode.afterFingerprint = fingerprint();
      await finishEpisode(episode);
      actionOutcomes.treeKey = { hits, acquired, caught,
        finalCarry: g.skull.carry?.id || null };
      assert(hits.length === 1 && hits[0].mode === 'outbound'
        && hits[0].segmentLength > 0
        && hits[0].recomputedDistance <= hits[0].radius + 0.0001
        && hits[0].suppliedDistance <= hits[0].radius + 0.0001,
      'tree key credit comes from exactly one real outbound swept segment', hits);
      assert(!acquired.targetEnabled && acquired.carryId === 'bedroomKey'
        && acquired.carryParent === acquired.jawMount && acquired.carryScale <= 1.15
        && acquired.mode === 'returning',
      'the physical key disables itself, rides in the jaw, and recalls the skull', acquired);
      assert(caught.hard === false && g.skull.mode === 'held'
        && g.skull.carry?.id === 'bedroomKey',
      'the key persists through a genuine non-hard catch', { caught,
        carry: g.skull.carry?.id, mode: g.skull.mode });
      assertActionColdFree(episode);
      episodes.push(episode);
    } finally { restoreTarget(); }
  };

  const runOffscreenStage = async () => {
    placePlayer(7.2, 3.6, 1.5);
    const forwardPoint = g.camera.getWorldPosition(g.player.pos.clone())
      .addScaledVector(g.camera.getWorldDirection(g.skull.pos.clone()), 12);
    aimAt(forwardPoint);
    await waitFor(residencyQuiescent, 'settled bedroom before offscreen growth');
    const episode = newEpisode('request-stage-onscreen-defer-offscreen-apply');
    episode.beforeFingerprint = fingerprint();
    const catchStart = completeCatchRecords.length;
    const originalSetStage = g.skull.setStage;
    const applications = [];
    g.skull.setStage = function tracedSetStage(stage) {
      applications.push({ stage, mode: this.mode, parent: this.root.parent?.uuid || null });
      return originalSetStage.call(this, stage);
    };
    try {
      // First flight step synchronizes root.position. Requesting the stage while
      // held would let the launch-frame projection observe a stale transform.
      await step(1 / 120, { throwPressed: true, throwHeld: true },
        'stage-launch-before-request', episode.operations);
      require(g.skull.mode === 'outbound', 'offscreen-growth fixture begins with a legal flight');
      const requested = Math.min(5, g.skull.stage + 1);
      timed('stage-request', () => g.skull.requestStage(requested), episode.operations);
      g.camera.updateMatrixWorld(true);
      g.skull.root.updateMatrixWorld(true);
      const onScreen = g.skull.root.getWorldPosition(g.skull.pos.clone()).project(g.camera);
      await step(1 / 120, { throwHeld: true },
        'stage-onscreen-defer', episode.operations);
      const deferred = { requested, stage: g.skull.stage,
        pending: g.skull.pendingStage, applications: applications.length,
        ndc: onScreen.toArray() };
      g.player.yaw += Math.PI;
      g.player._sync(0);
      g.camera.updateMatrixWorld(true);
      g.skull.root.updateMatrixWorld(true);
      const offscreen = g.skull.root.getWorldPosition(g.skull.pos.clone()).project(g.camera);
      const reallyOffscreen = !(offscreen.z > -1 && offscreen.z < 1
        && Math.abs(offscreen.x) < 1.12 && Math.abs(offscreen.y) < 1.12);
      await step(1 / 120, { throwHeld: true },
        'stage-offscreen-apply', episode.operations);
      const applied = { requested, stage: g.skull.stage,
        pending: g.skull.pendingStage, applications: clone(applications),
        ndc: offscreen.toArray(), reallyOffscreen };
      await step(1 / 60, { throwHeld: true },
        'stage-no-double-apply', episode.operations);
      const applicationsAfter = applications.length;
      await step(1 / 120, { throwReleased: true },
        'stage-release', episode.operations);
      const caught = await waitNaturalCatch(episode, 'offscreen stage', catchStart);
      episode.afterFingerprint = fingerprint();
      await finishEpisode(episode);
      actionOutcomes.offscreenStage = { deferred, applied, applicationsAfter, caught };
      assert(onScreen.z > -1 && onScreen.z < 1 && Math.abs(onScreen.x) < 1.12
        && Math.abs(onScreen.y) < 1.12 && deferred.stage < requested
        && deferred.pending === requested && deferred.applications === 0,
      'an actually on-screen outbound skull defers requested growth', deferred);
      assert(reallyOffscreen && applied.stage === requested
        && applied.pending === requested && applied.applications.length === 1
        && applied.applications[0].mode === 'outbound'
        && applied.applications[0].parent === g.scene.uuid
        && applicationsAfter === 1,
      'one real offscreen flight step applies growth exactly once without hiding the skull',
      applied);
      assert(caught.hard === false && g.skull.mode === 'held',
        'grown skull still returns through the normal non-hard catch path', caught);
      assertActionColdFree(episode);
      episodes.push(episode);
    } finally { g.skull.setStage = originalSetStage; }
  };

  const runFlame = async (kind) => {
    if (kind === 'guest') {
      timed('guest-door-production-open', () => {
        const opened = g.voidDoorBeat.open('stage-c-dynamics-fixture');
        require(opened === true, 'guest fixture opens the authored door exactly once', opened);
      });
      await stepSlices(0.9, {}, 'guest-door-settle', setupOperations);
      placePlayer(1, 0, -8.8);
    } else {
      timed('pilot-teleport-basement', () => F.teleport('basement'));
      timed('pilot-clear-hostiles', () => g.enemies.clear());
      placePlayer(7, -3, 3.55);
    }
    const target = kind === 'guest'
      ? g.world.fetchTargets.find((entry) => entry.id === 'guestFlame')
      : g.basementPilot?.target;
    require(target?.enabled, `${kind} flame target is physically enabled`, {
      target: target?.id, enabled: target?.enabled,
    });
    aimAt(targetPoint(target));
    await waitFor(residencyQuiescent, `settled ${kind} flame sightline`);
    const carriedFlameProof = assertCarriedFlameBindings(kind);
    const hits = [];
    const restoreTarget = installTargetTrace(target, hits);
    let bellRings = 0;
    const originalBell = g.audio.bellRing;
    if (kind === 'pilot') g.audio.bellRing = function tracedPilotBell(...args) {
      bellRings++;
      return originalBell?.apply(this, args);
    };
    const before = flameState();
    const episode = newEpisode(`${kind}-flame-real-swept-transfer`);
    episode.beforeFingerprint = fingerprint();
    const catchStart = completeCatchRecords.length;
    try {
      await step(1 / 120, { throwPressed: true, throwHeld: true },
        `${kind}-flame-press`, episode.operations);
      for (let index = 0; index < 240 && !g.flags.has('ateFlame'); index++) {
        await step(1 / 120, { throwHeld: true },
          `${kind}-flame-flight-${index + 1}`, episode.operations);
      }
      require(g.flags.has('ateFlame'), `${kind} flame is stolen by the real bounded flight`, {
        skull: g.skull.getState(), hits,
      });
      const caught = await waitNaturalCatch(episode, `${kind} flame`, catchStart);
      await stepSlices(0.72, {}, `${kind}-flame-transfer-settle`, episode.operations);
      const after = flameState();
      episode.afterFingerprint = fingerprint();
      await finishEpisode(episode);
      const pilot = kind === 'pilot' ? {
        relaySolved: g.flags.has('windowRelaySolved'),
        relayBasementPilot: g.flags.has('windowRelayBasementPilot'),
        pilotUsed: g.flags.has('basementPilotUsed'),
        solveSource: g.windowRelay?.solveSource || null,
        bellRings,
      } : null;
      const outcome = { kind, before, after, hits, caught, pilot };
      actionOutcomes[`${kind}Flame`] = outcome;
      assert(!before.ateFlame && before.sources.find((source) =>
        source.id === (kind === 'guest' ? 'guest-candle' : 'basement-pilot'))?.targetEnabled,
      `${kind} flame begins as an unspent physical source`, before);
      assert(hits.length === 1 && hits[0].mode === 'outbound'
        && hits[0].segmentLength > 0
        && hits[0].recomputedDistance <= hits[0].radius + 0.0001
        && hits[0].suppliedDistance <= hits[0].radius + 0.0001,
      `${kind} flame credit comes from exactly one real outbound swept segment`, hits);
      assert(after.ateFlame && after.carriedFlameVisible
        && after.source === (kind === 'guest' ? 'guest-candle' : 'basement-pilot')
        && after.sources.every((source) => !source.targetEnabled
          && source.partsVisible.every((visible) => !visible)
          && source.glowIntensity === 0 && !source.inCandles && source.poolOwners === 0),
      `${kind} theft atomically extinguishes every duplicate and establishes one carried source`,
      after);
      assert(after.transfer.complete === true && after.transfer.active === false
        && after.transfer.frames > 0 && after.transfer.sparkIterations > 0
        && after.transfer.embers === 2 && after.transfer.emberActive === 2
        && after.transfer.sparks === 7 && after.transfer.visibleSparks === 0,
      `${kind} transfer uses the prebuilt two-ember/seven-spark effect and completes`,
      after.transfer);
      assert(caught.hard === false && g.skull.mode === 'held',
        `${kind} theft returns through one natural non-hard catch`, caught);
      if (pilot) assert(pilot.relaySolved && pilot.relayBasementPilot
        && pilot.pilotUsed && pilot.solveSource === 'basement-pilot'
        && pilot.bellRings === 1,
      'basement pilot theft solves and rings the real relay exactly once', pilot);
      assertCarriedFlameActionBindings(kind, episode, carriedFlameProof);
      assertActionColdFree(episode);
      episodes.push(episode);
    } finally {
      restoreTarget();
      if (kind === 'pilot') g.audio.bellRing = originalBell;
    }
  };

  const renderables = (roots) => {
    const meshes = new Set();
    const exactOnly = new Set();
    const all = new Set();
    for (const root of roots.filter(Boolean)) root.traverse((object) => {
      if ((!object.isMesh && !object.isLine && !object.isPoints)
          || !object.geometry || !object.material || all.has(object.uuid)) return;
      all.add(object.uuid);
      if (object.isLine || object.isPoints) exactOnly.add(object.uuid);
      else if (object.isMesh) meshes.add(object.uuid);
    });
    return {
      reduced: [...meshes].sort(),
      exactOnly: [...exactOnly].sort(),
      all: [...all].sort(),
      intersection: [...meshes].filter((uuid) => exactOnly.has(uuid)).sort(),
    };
  };
  const equalSorted = (left, right) => JSON.stringify([...(left || [])].sort())
    === JSON.stringify([...(right || [])].sort());
  const findProbeSources = () => {
    const line = g.scene.getObjectByName('shattered windshield star');
    const points = g.scene.getObjectByName('clearing pale glow-motes');
    let mesh = null;
    g.scene.traverse((object) => {
      if (mesh || !object.isMesh || object.isInstancedMesh || object.isSkinnedMesh
          || !object.geometry?.attributes?.position || !object.material) return;
      if (Array.isArray(object.material)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.length !== 1 || materials[0]?.visible === false) return;
      if (object.geometry.attributes.position.count > 240) return;
      mesh = object;
    });
    require(mesh && line?.isLine && points?.isPoints,
      'shipping Mesh, Line, and Points sources exist for private district probes', {
        mesh: mesh?.name || mesh?.uuid,
        line: line?.name || null,
        points: points?.name || null,
      });
    return { mesh, line, points };
  };
  const registerProbeArrays = (object, label, type) => {
    const geometry = object.geometry;
    if (geometry.index?.array) probeArrays.set(geometry.index.array, {
      label, type, objectUuid: object.uuid, geometryUuid: geometry.uuid, role: 'index',
    });
    for (const [name, attribute] of Object.entries(geometry.attributes || {})) {
      if (attribute?.array) probeArrays.set(attribute.array, {
        label, type, objectUuid: object.uuid, geometryUuid: geometry.uuid,
        role: `attribute:${name}`,
      });
    }
    for (const [name, attributes] of Object.entries(geometry.morphAttributes || {})) {
      for (const [index, attribute] of (attributes || []).entries()) {
        if (attribute?.array) probeArrays.set(attribute.array, {
          label, type, objectUuid: object.uuid, geometryUuid: geometry.uuid,
          role: `morph:${name}:${index}`,
        });
      }
    }
  };
  const createProbe = (source, label, type) => {
    const geometry = source.geometry.clone();
    const privateArrays = (!source.geometry.index || geometry.index?.array
        !== source.geometry.index?.array)
      && Object.entries(source.geometry.attributes || {}).every(([name, attribute]) =>
        geometry.attributes?.[name]?.array !== attribute?.array)
      && Object.entries(source.geometry.morphAttributes || {}).every(([name, attributes]) =>
        (attributes || []).every((attribute, index) =>
          geometry.morphAttributes?.[name]?.[index]?.array !== attribute?.array));
    require(privateArrays, `${label} ${type} probe owns cloned private BufferAttribute arrays`);
    geometry.center();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const object = new source.constructor(geometry, source.material);
    object.name = `${label} private ${type} residency probe`;
    object.visible = true;
    object.frustumCulled = true;
    object.castShadow = false;
    object.receiveShadow = false;
    object.layers.set(0);
    const radius = Math.max(0.001, geometry.boundingSphere?.radius || 1);
    object.scale.setScalar(0.28 / radius);
    registerProbeArrays(object, label, type);
    probeGeometryMeta.set(geometry.uuid, {
      label, type, objectUuid: object.uuid, geometryUuid: geometry.uuid,
    });
    const before = object.onBeforeRender;
    object.onBeforeRender = function recordProbeSubmission(rendererArg, ...args) {
      probeSubmissions.push({ label, type, objectUuid: this.uuid,
        geometryUuid: this.geometry?.uuid || null,
        phase: phaseStack.at(-1) || (activeFrame ? 'visible-render' : 'async-outside'),
        targetUuid: rendererArg.getRenderTarget?.()?.texture?.uuid || null,
        frameId: activeFrame?.frameId || null });
      return before?.call(this, rendererArg, ...args);
    };
    cleanup.push(() => { object.onBeforeRender = before; });
    return object;
  };
  const addRegistryEntry = (array, object) => {
    array.push(object);
    return () => {
      const index = array.indexOf(object);
      if (index >= 0) array.splice(index, 1);
    };
  };
  const registerDistrictProbes = (label, probes) => {
    const removes = [];
    if (label === 'ossuary') {
      g.ossuary.root.add(...probes);
    } else {
      g.scene.add(...probes);
    }
    if (label === 'graveyard') {
      for (const probe of probes) {
        removes.push(addRegistryEntry(g.outsideRenderRoots, probe));
        removes.push(addRegistryEntry(g.forest.detailRoots, probe));
        g.forest._detailBaseVisibility.set(probe, true);
        removes.push(() => g.forest._detailBaseVisibility.delete(probe));
      }
    } else if (label === 'forest' || label === 'clearing') {
      for (const probe of probes) removes.push(addRegistryEntry(g.outsideRenderRoots, probe));
    } else if (label === 'cave') {
      for (const probe of probes) {
        probe.userData.underfalls = true;
        removes.push(addRegistryEntry(g.underfalls.renderRoots, probe));
        g.underfalls.renderVisibility.set(probe, true);
        removes.push(() => g.underfalls.renderVisibility.delete(probe));
      }
    }
    return () => {
      for (const remove of removes.reverse()) remove();
      for (const probe of probes) probe.removeFromParent();
    };
  };
  const positionProbesBehindCamera = (probes) => {
    g.scene.updateMatrixWorld(true);
    g.camera.updateMatrixWorld(true);
    const cameraPosition = g.camera.getWorldPosition(g.player.pos.clone());
    const forward = g.camera.getWorldDirection(g.skull.pos.clone());
    const common = cameraPosition.clone().addScaledVector(forward, -8);
    common.y = cameraPosition.y;
    for (const [index, probe] of probes.entries()) {
      const world = common.clone();
      world.x += (index - 1) * 0.42;
      if (probe.parent === g.scene) probe.position.copy(world);
      else probe.position.copy(probe.parent.worldToLocal(world));
    }
    g.scene.updateMatrixWorld(true);
    return common;
  };
  const transactionSummary = (entry) => ({
    generation: entry.generation, key: entry.key, kind: entry.kind,
    batch: entry.batch, objects: entry.objects, geometries: entry.geometries,
    types: entry.types, geometryBytes: entry.geometryBytes,
    submittedElements: entry.submittedElements,
    oversize: entry.oversize, isolatedOversize: entry.isolatedOversize,
    durationMs: entry.durationMs,
    programSelectionDurationMs: entry.programSelectionDurationMs || 0,
    programSelectionObjects: entry.programSelectionObjects || 0,
    programDelta: entry.programDelta,
    textureDelta: entry.textureDelta, geometryDelta: entry.geometryDelta,
    committed: entry.committed, stateRestored: entry.stateRestored,
    generationStable: entry.generationStable, fingerprintsStable: entry.fingerprintsStable,
    queuePrefixStable: entry.queuePrefixStable, error: entry.error,
    sources: (entry.identity?.sources || []).map((source) => ({
      object: source.object, objectUuid: source.objectUuid,
      geometryUuid: source.geometryUuid, objectType: source.objectType,
      preloadDeferred: source.preloadDeferred, entryKey: source.entryKey,
      newGeometry: source.newGeometry,
    })),
    programIdentityCount: entry.identity?.programIdentity?.count ?? null,
  });
  const transactionValidity = (entry) => {
    const withinCaps = entry.geometries <= caps.geometries
      && entry.objects <= caps.objects
      && entry.geometryBytes <= caps.bytes
      && entry.submittedElements <= caps.elements;
    const core = entry.error == null && entry.durationMs < 100
      && entry.programSelectionDurationMs < 100
      && (entry.kind.includes('exact-preload')
        ? entry.programSelectionObjects === entry.objects
        : entry.programSelectionObjects === 0)
      && entry.programDelta === 0 && entry.textureDelta === 0
      && entry.committed === true && entry.stateRestored === true
      && entry.generationStable === true && entry.fingerprintsStable === true
      && entry.queuePrefixStable === true && entry.programIdentityCount === 0;
    const capsValid = withinCaps
      ? entry.oversize == null && entry.isolatedOversize !== true
      : entry.objects === 1 && entry.geometries === 1
        && entry.isolatedOversize === true && Boolean(entry.oversize?.reason);
    return { core, capsValid, withinCaps };
  };
  const assertTransaction = (entry, label) => {
    const validity = transactionValidity(entry);
    assert(validity.core,
    `${label} is a clean transactional program/texture-neutral strict sub-100ms batch`, entry);
    assert(validity.capsValid,
    `${label} respects ordinary caps or isolates one named oversize`, entry);
  };

  const routeDistrict = (label) => {
    const envelopeStartedAt = performance.now();
    if (label === 'graveyard') {
      timed('district-teleport-graveyard', () => F.teleport('graveyard'));
      placePlayer(2, g.world.groundHeightAt(2, 33, 3), 33);
      timed('graveyard-overlap-activation', () => F.stepWith(1 / 120, {}, false));
    } else if (label === 'ossuary') {
      timed('ossuary-unlock-production', () => g.ossuary.unlock('stage-c-dynamics'));
      const connector = g.ossuary.entranceConnector;
      const portalZ = connector.portalZ + 0.08;
      const portalY = g.world.groundHeightAt(g.ritualMausoleum.x, portalZ,
        g.ossuary.origin.floor + 1);
      placePlayer(g.ritualMausoleum.x, portalY, portalZ);
      timed('ossuary-production-entry', () => F.stepWith(1 / 120, {}, false));
      require(g.ossuary.inOssuary && g.flags.has('ossuaryEntered'),
        'physical mausoleum threshold enters the ossuary through production', {
          inOssuary: g.ossuary.inOssuary,
          entered: g.flags.has('ossuaryEntered'),
          position: g.player.pos.toArray(),
        });
    } else if (label === 'forest') {
      timed('district-teleport-forest', () => F.teleport('forest'));
      timed('forest-route-activation', () => F.stepWith(1 / 120, {}, false));
    } else if (label === 'clearing') {
      timed('district-teleport-clearing', () => F.teleport('clearing'));
      timed('clearing-route-activation', () => F.stepWith(1 / 120, {}, false));
    } else if (label === 'cave') {
      timed('district-teleport-cave', () => F.teleport('cave'));
      timed('cave-route-activation', () => F.stepWith(1 / 120, {}, false));
      require(g.flags.has('waterfallTaken') && g.skull.mode === 'gone'
        && g.skull.root.parent == null && !g.skull.tether.visible,
      'cave begins from the real irreversible gone-skull route', {
        waterfallTaken: g.flags.has('waterfallTaken'),
        mode: g.skull.mode, parent: g.skull.root.parent?.uuid || null,
        tether: g.skull.tether.visible,
      });
    }
    setupOperations.push({
      label: `${label}-route-task-envelope`,
      durationMs: performance.now() - envelopeStartedAt,
      error: null,
    });
  };
  const exitOssuary = async () => {
    for (let index = 0; index < 15 && g.ossuary.portalCooldown > 0; index++) {
      await step(0.04, {}, `ossuary-cooldown-${index + 1}`);
    }
    placePlayer(g.ossuary.origin.x, g.ossuary.origin.floor,
      g.ossuary.origin.z + 0.2);
    await step(1 / 120, {}, 'ossuary-production-backtrack');
    require(!g.ossuary.inOssuary && !g.ossuary.root.visible,
      'physical backtrack exits and hides the sealed ossuary before forest', {
        inOssuary: g.ossuary.inOssuary,
        rootVisible: g.ossuary.root.visible,
        exitPasses: g.ossuary.visibility?.exitPasses,
      });
  };
  const runWaterfall = async () => {
    const target = g.world.fetchTargets.find((entry) => entry.id === 'waterfall');
    require(target?.enabled, 'waterfall target is enabled by the production clearing act');
    const C = g.clearingCenter;
    placePlayer(C.x, g.world.groundHeightAt(C.x, C.z + 6, 3), C.z + 6);
    aimAt(targetPoint(target));
    await waitFor(residencyQuiescent, 'settled clearing before waterfall sacrifice');
    const hits = [];
    const restoreTarget = installTargetTrace(target, hits);
    const episode = newEpisode('waterfall-real-swept-sacrifice');
    episode.beforeFingerprint = fingerprint();
    try {
      await step(1 / 120, { throwPressed: true, throwHeld: true },
        'waterfall-press', episode.operations);
      for (let index = 0; index < 300 && !g.flags.has('waterfallTaken'); index++) {
        await step(1 / 120, { throwHeld: true },
          `waterfall-flight-${index + 1}`, episode.operations);
      }
      episode.afterFingerprint = fingerprint();
      await finishEpisode(episode);
      const outcome = { hits, waterfallTaken: g.flags.has('waterfallTaken'),
        mode: g.skull.mode, parent: g.skull.root.parent?.uuid || null,
        tetherVisible: !!g.skull.tether.visible, caveEnabled: !!g.caveZone?.enabled };
      actionOutcomes.waterfall = outcome;
      assert(hits.length === 1 && hits[0].mode === 'outbound'
        && hits[0].directive === 'gone' && hits[0].segmentLength > 0
        && hits[0].recomputedDistance <= hits[0].radius + 0.0001,
      'waterfall bargain comes from exactly one real outbound swept hit', hits);
      assert(outcome.waterfallTaken && outcome.mode === 'gone'
        && outcome.parent == null && !outcome.tetherVisible && outcome.caveEnabled,
      'waterfall transaction irreversibly removes the live skull and opens Underfalls',
      outcome);
      assertEpisodeTiming(episode);
      assert(episode.visibleResourceFrames.length === 0,
        'waterfall sacrifice adds no visible renderer resources',
        episode.visibleResourceFrames);
      const total = glTotal(episode.glByPhase);
      assert(total.bufferData === 0 && total.createVertexArray === 0
        && total.unallocatedBufferSubData === 0,
      'waterfall sacrifice owns no cold buffer or VAO work', total);
      episodes.push(episode);
    } finally { restoreTarget(); }
  };

  const runDistrictCase = async (label) => {
    pauseDeferred = true;
    const episode = newEpisode(`${label}-deferred-camera-promotion`);
    episode.beforeFingerprint = fingerprint();
    const constructionStartedAt = performance.now();
    const sources = findProbeSources();
    const probeUploadStart = probeUploads.length;
    const probeVaoStart = probeVaos.length;
    const submissionStart = probeSubmissions.length;
    const probes = [
      createProbe(sources.mesh, label, 'Mesh'),
      createProbe(sources.line, label, 'Line'),
      createProbe(sources.points, label, 'Points'),
    ];
    const [mesh, line, points] = probes;
    const removeRegistry = registerDistrictProbes(label, probes);
    try {
      const target = positionProbesBehindCamera(probes);
      episode.operations.push({
        label: `${label}-probe-construction-registration`,
        durationMs: performance.now() - constructionStartedAt,
        error: null,
      });
      const district = g._currentDeferredGpuRoots();
      require(district.label === label,
        `${label} production deferred-root selector names the expected physical district`, {
          expected: label, actual: district.label,
        });
      const expected = renderables(district.roots);
      await waitFor(residencyPhysicalReady, `${label} cold first exact physical view`);
      const residency = g.currentGpuResidency;
      const progress = residency.progressive;
      const generation = g._webglGeneration;
      g._updateReducedWorldFrustum();
      const deferredKeys = probes.map((object) => g._exactResidencyEntryKey(object, {
        preloadDeferred: label, rig: 'world',
      }));
      const criticalKeys = probes.map((object) => g._exactResidencyEntryKey(object, {
        critical: true, rig: 'world',
      }));
      const cold = {
        candidates: {
          mesh: g._reducedPhysicalCandidate(mesh),
          line: g._exactPhysicalCandidate(line),
          points: g._exactPhysicalCandidate(points),
        },
        mesh: {
          universe: progress.deferredUniverse.has(mesh.uuid),
          queued: progress.deferredQueue.some((entry) => entry.object === mesh),
          processed: progress.processed.has(mesh.uuid),
          covered: progress.deferredCovered.has(mesh.uuid),
          geometrySeen: progress.geometrySeen.has(mesh.geometry.uuid),
        },
        exactOnly: {
          line: progress.deferredExactOnly.has(line.uuid),
          points: progress.deferredExactOnly.has(points.uuid),
          lineOmission: progress.omittedReduced.get(line.uuid) || null,
          pointsOmission: progress.omittedReduced.get(points.uuid) || null,
        },
        deferredKeys: deferredKeys.map((key) => ({ key,
          universe: progress.deferredExactUniverse.has(key),
          queued: progress.deferredExactQueue.some((entry) => entry.key === key),
          processed: progress.exactProcessed.has(key),
          covered: progress.deferredExactCovered.has(key),
        })),
        criticalKeys: criticalKeys.map((key) => ({ key,
          universe: progress.exactUniverse.has(key),
          processed: progress.exactProcessed.has(key),
          covered: progress.exactCovered.has(key),
        })),
        probeUploads: probeUploads.slice(probeUploadStart),
        pausedDeferredCalls,
      };
      require(!cold.candidates.mesh && !cold.candidates.line && !cold.candidates.points,
        `${label} private Mesh/Line/Points all begin outside the physical frustum`, cold.candidates);
      require(cold.mesh.universe && cold.mesh.queued && !cold.mesh.processed
        && !cold.mesh.covered && !cold.mesh.geometrySeen,
      `${label} cold Mesh begins only in the future reduced universe`, cold.mesh);
      require(cold.exactOnly.line && cold.exactOnly.points
        && cold.exactOnly.lineOmission === 'line'
        && cold.exactOnly.pointsOmission === 'points'
        && cold.deferredKeys.every((entry) => entry.universe && entry.queued
          && !entry.processed && !entry.covered)
        && cold.criticalKeys.every((entry) => !entry.universe
          && !entry.processed && !entry.covered),
      `${label} Line/Points are exact-only deferred entries and no critical key exists before the turn`,
      cold);
      require(cold.probeUploads.length === 0,
        `${label} private arrays have no GL upload before the turn`, cold.probeUploads);

      const beforePromotion = progress.deferredPromotedObjects;
      aimAt(target);
      timed(`${label}-update-frustum-diagnostic`, () => g._updateReducedWorldFrustum(),
        episode.operations);
      const turnedCandidates = {
        mesh: g._reducedPhysicalCandidate(mesh),
        line: g._exactPhysicalCandidate(line),
        points: g._exactPhysicalCandidate(points),
      };
      require(turnedCandidates.mesh && turnedCandidates.line && turnedCandidates.points,
        `${label} camera turn places all three private renderables in the real frustum`,
        turnedCandidates);
      const fullDeadline = performance.now() + 180000;
      let firstFull = null;
      while (!firstFull && performance.now() < fullDeadline) {
        await frame();
        const latest = episode.lastFrame;
        if (residency.physical.has(progress.key) && !g.lastRender?.reducedDetail
            && (g.lastRender?.worldDrawCalls || 0) > 0
            && progress.exactProcessed.has(criticalKeys[0])
            && progress.exactProcessed.has(criticalKeys[1])
            && progress.exactProcessed.has(criticalKeys[2])) {
          firstFull = latest ? clone(latest) : {
            frameId: frameSerial, worldDrawCalls: g.lastRender.worldDrawCalls,
            reducedDetail: g.lastRender.reducedDetail,
          };
        }
      }
      require(firstFull != null, `${label} reaches a later full exact paint after critical promotion`, {
        progress: fingerprint(),
      });
      const criticalBatches = (residency.exactPreloadPasses || [])
        .filter((entry) => entry.generation === generation
          && entry.key === progress.key && entry.kind === 'current-exact-preload-batch'
          && (entry.identity?.sources || []).some((source) => probes.includes(
            probes.find((probe) => probe.uuid === source.objectUuid))))
        .map(transactionSummary);
      const reducedBatches = (residency.reducedPasses || [])
        .filter((entry) => entry.generation === generation && entry.key === progress.key
          && (entry.identity?.sources || []).some((source) => source.objectUuid === mesh.uuid))
        .map(transactionSummary);
      const criticalSourceKeys = new Set(criticalBatches.flatMap((entry) =>
        entry.sources.map((source) => source.entryKey).filter(Boolean)));
      const currentUploads = probeUploads.slice(probeUploadStart);
      const currentVaos = probeVaos.slice(probeVaoStart);
      const currentSubmissions = probeSubmissions.slice(submissionStart);
      const firstFullSubmissions = currentSubmissions.filter((entry) =>
        entry.phase === 'visible-render' && entry.targetUuid == null
          && entry.frameId === firstFull.frameId);
      const exactPhase = episode.glByPhase['current-exact-preload'] || makeGl();
      const visiblePhase = episode.glByPhase['visible-render'] || makeGl();
      const reducedPhase = episode.glByPhase['reduced-preload'] || makeGl();
      const beforeDrain = {
        promotionDelta: progress.deferredPromotedObjects - beforePromotion,
        processed: probes.map((probe) => ({ uuid: probe.uuid,
          reduced: progress.processed.has(probe.uuid),
          critical: progress.exactProcessed.has(
            g._exactResidencyEntryKey(probe, { critical: true, rig: 'world' })),
          criticalCovered: progress.exactCovered.has(
            g._exactResidencyEntryKey(probe, { critical: true, rig: 'world' })),
        })),
        reducedBatches,
        criticalBatches,
        currentUploads,
        currentVaos,
        firstFullSubmissions,
        firstFull,
        gl: clone({ reducedPhase, exactPhase, visiblePhase }),
      };
      assert(beforeDrain.promotionDelta >= 1 && progress.processed.has(mesh.uuid)
        && progress.deferredCovered.has(mesh.uuid) && progress.geometrySeen.has(mesh.geometry.uuid),
      `${label} camera turn promotes and commits the private Mesh through the reduced lane`,
      beforeDrain);
      assert(reducedBatches.some((entry) => entry.sources.some((source) =>
        source.objectUuid === mesh.uuid && source.preloadDeferred === label)),
      `${label} reduced transaction names the exact promoted Mesh source`, reducedBatches);
      assert(criticalKeys.every((key) => progress.exactProcessed.has(key)
        && progress.exactCovered.has(key) && criticalSourceKeys.has(key)),
      `${label} all Mesh/Line/Points critical keys commit in named exact preload batches before full reveal`,
      { criticalKeys, criticalSourceKeys: [...criticalSourceKeys], criticalBatches });
      const linePositionUpload = currentUploads.some((entry) => entry.type === 'Line'
        && entry.role === 'attribute:position' && entry.method === 'bufferData'
        && entry.phase === 'current-exact-preload');
      const pointPositionUpload = currentUploads.some((entry) => entry.type === 'Points'
        && entry.role === 'attribute:position' && entry.method === 'bufferData'
        && entry.phase === 'current-exact-preload');
      const meshBufferUpload = currentUploads.some((entry) => entry.type === 'Mesh'
        && entry.method === 'bufferData' && entry.phase === 'reduced-preload');
      const exactVaoTypes = new Set(currentVaos
        .filter((entry) => entry.phase === 'current-exact-preload')
        .map((entry) => entry.type));
      assert(meshBufferUpload && reducedPhase.bufferData > 0
        && linePositionUpload && pointPositionUpload && exactPhase.bufferData > 0
        && exactPhase.createVertexArray > 0
        && ['Mesh', 'Line', 'Points'].every((type) => exactVaoTypes.has(type)),
      `${label} hidden reduced/exact phases own the private Mesh/Line/Points cold buffers and mappings`,
      { currentUploads, currentVaos, reducedPhase, exactPhase });
      assert(currentUploads.every((entry) => ['reduced-preload', 'current-exact-preload']
        .includes(entry.phase)),
      `${label} no private array first uploads in a visible, certificate, deferred, or unowned phase`,
      currentUploads);
      assert(firstFullSubmissions.some((entry) => entry.objectUuid === mesh.uuid)
        && firstFullSubmissions.some((entry) => entry.objectUuid === line.uuid)
        && firstFullSubmissions.some((entry) => entry.objectUuid === points.uuid),
      `${label} first exact production view actually submits every private family on the default framebuffer`,
      firstFullSubmissions);
      assert(visiblePhase.bufferData === 0 && visiblePhase.createVertexArray === 0
        && visiblePhase.unallocatedBufferSubData === 0
        && visiblePhase.bufferAllocationProbeErrors === 0
        && firstFull.visibleProgramDelta === 0
        && firstFull.visibleTextureDelta === 0
        && firstFull.visibleGeometryDelta === 0,
      `${label} first full reveal is resource-neutral with no cold buffer or VAO work`, {
        firstFull, visiblePhase,
      });
      for (const entry of [...reducedBatches, ...criticalBatches]) {
        assertTransaction(entry, `${label} ${entry.kind} #${entry.batch}`);
      }
      pauseDeferred = false;
      await waitFor(() => progress.deferredQueue.length === 0
        && progress.deferredExactQueue.length === 0
        && progress.deferredRecorded && progress.deferredExactRecorded
        && g.shaderWarmup?.status === 'ready'
        && (g._shaderCompileActivity?.active || 0) === 0,
      `${label} complete deferred reduced/exact drain`, 240000);
      const universe = [...(residency.deferredUniverses || [])]
        .filter((entry) => entry.key === progress.key && entry.label === label).at(-1) || null;
      require(universe, `${label} records one complete deferred universe`);
      const finalizePasses = (residency.universeFinalizePasses || [])
        .filter((entry) => entry.generation === generation && entry.key === progress.key
          && entry.kind === 'deferred-exact-finalize')
        .map((entry) => ({ ...entry }));
      assert(finalizePasses.length > 0
        && finalizePasses.some((entry) => entry.recorded === true)
        && finalizePasses.every((entry) => entry.error == null
          && entry.scanDurationMs < 100 && entry.recordDurationMs < 100
          && entry.durationMs < 100),
      `${label} final deferred scan and universe record own a clean isolated sub-100ms paint`,
      finalizePasses);
      const allReduced = (residency.reducedPasses || [])
        .filter((entry) => entry.generation === generation && entry.key === progress.key)
        .map(transactionSummary);
      const allExact = (residency.exactPreloadPasses || [])
        .filter((entry) => entry.generation === generation && entry.key === progress.key)
        .map(transactionSummary);
      for (const entry of [...allReduced, ...allExact]) {
        assertTransaction(entry, `${label} final ${entry.kind} #${entry.batch}`);
      }
      const linePointUuids = new Set([line.uuid, points.uuid]);
      assert(equalSorted(universe.members, expected.reduced)
        && equalSorted(universe.coveredMembers, expected.reduced)
        && equalSorted(universe.exactOnlyMembers, expected.exactOnly)
        && equalSorted(universe.exactMembers, expected.all)
        && equalSorted(universe.exactCoveredMembers, expected.all)
        && expected.intersection.length === 0
        && universe.total === universe.covered
        && universe.exactTotal === universe.exactCovered,
      `${label} partitions reduced Mesh from exact-only Line/Points and covers the authored future universe`,
      { expected, universe });
      assert(allReduced.every((entry) => entry.sources.every((source) =>
        !linePointUuids.has(source.objectUuid)))
        && allExact.some((entry) => entry.kind === 'deferred-exact-preload-batch'
          && entry.sources.some((source) => source.objectUuid === line.uuid))
        && allExact.some((entry) => entry.kind === 'deferred-exact-preload-batch'
          && entry.sources.some((source) => source.objectUuid === points.uuid)),
      `${label} omits Line/Points from reduced batches and names both in deferred exact batches`,
      { allReduced, allExact });
      const uploadsBeforeSteady = probeUploads.length;
      const scansBeforeSteady = progress.exactRefreshes;
      const promotionsBeforeSteady = progress.deferredPromotedObjects;
      for (let turn = 0; turn < 4; turn++) {
        g.player.yaw += Math.PI / 2;
        g.player._sync(0);
        await frame();
      }
      assert(probeUploads.length === uploadsBeforeSteady
        && progress.exactRefreshes === scansBeforeSteady
        && progress.deferredPromotedObjects === promotionsBeforeSteady
        && residencyPhysicalReady(),
      `${label} steady four-way look sweep performs no new probe upload, scan, or promotion`, {
        uploadsBeforeSteady, uploadsAfter: probeUploads.length,
        scansBeforeSteady, scansAfter: progress.exactRefreshes,
        promotionsBeforeSteady, promotionsAfter: progress.deferredPromotedObjects,
      });
      episode.afterFingerprint = fingerprint();
      await finishEpisode(episode);
      const episodeGl = glTotal(episode.glByPhase);
      const finalVisiblePhase = episode.glByPhase['visible-render'] || makeGl();
      const finalProbeUploads = probeUploads.slice(probeUploadStart);
      const finalProbeVaos = probeVaos.slice(probeVaoStart);
      assert(episodeGl.unallocatedBufferSubData === 0
        && episodeGl.bufferAllocationProbeErrors === 0,
      `${label} every hidden and visible phase uses only allocated buffers with healthy allocation probes`,
      episodeGl);
      assert(finalVisiblePhase.bufferData === 0
        && finalVisiblePhase.createVertexArray === 0
        && finalVisiblePhase.unallocatedBufferSubData === 0
        && finalVisiblePhase.bufferAllocationProbeErrors === 0,
      `${label} remains allocation- and VAO-free in every visible frame through deferred drain and steady sweeps`,
      finalVisiblePhase);
      assert(finalProbeUploads.length === currentUploads.length
        && finalProbeVaos.length === currentVaos.length,
      `${label} later deferred certification reuses every private buffer and mapping earned before first full reveal`, {
        beforeDrainUploads: currentUploads,
        finalProbeUploads,
        beforeDrainVaos: currentVaos,
        finalProbeVaos,
      });
      assertEpisodeTiming(episode);
      assert(episode.visibleResourceFrames.length === 0 && episode.shieldedFrames === 0,
        `${label} promotion exposes no cold-resource or shielded visible frame`, {
          resourceFrames: episode.visibleResourceFrames,
          shieldedFrames: episode.shieldedFrames,
        });
      districtCases.push({
        label, generation, key: progress.key,
        objects: probes.map((probe) => ({ name: probe.name, type: probe.type,
          uuid: probe.uuid, geometryUuid: probe.geometry.uuid })),
        expected, cold, turnedCandidates, beforeDrain,
        universe: clone(universe),
        finalizePasses,
        allReduced, allExact,
        probeUploads: probeUploads.slice(probeUploadStart),
        probeVaos: probeVaos.slice(probeVaoStart),
        submissions: probeSubmissions.slice(submissionStart),
        episode: clone(episode),
      });
      episodes.push(episode);
    } finally {
      activeEpisode = null;
      pauseDeferred = false;
      g.render = () => {};
      const residencyErrorsBeforeReset = [...(g.currentGpuResidency?.errors || [])];
      const shaderErrorsBeforeReset = [...(g.shaderWarmup?.errors || [])];
      observedResidencyErrors.push(...residencyErrorsBeforeReset.map((error) => ({
        stage: label, error,
      })));
      observedShaderErrors.push(...shaderErrorsBeforeReset.map((error) => ({
        stage: label, error,
      })));
      assert(residencyErrorsBeforeReset.length === 0,
        `${label} records no residency error before cleanup resets its progress`,
        residencyErrorsBeforeReset);
      assert(shaderErrorsBeforeReset.length === 0,
        `${label} records no shader error before cleanup reprioritizes the itinerary`,
        shaderErrorsBeforeReset);
      removeRegistry();
      timed(`${label}-probe-residency-reset`, () =>
        g._resetCurrentGpuResidency(`${label}-deferred-probe-cleanup`));
      for (const probe of probes) probe.geometry.dispose();
      g.render = measuredRender;
      previousRaf = null;
    }
  };

  const runScenario = async () => {
    timed('wake-start', () => F.start());
    g._selfStep = false;
    if (scenario === 'house-actions') {
      timed('clear-action-hostiles', () => g.enemies.clear());
      await runActionThrow();
      await runTreeKey();
      await runOffscreenStage();
    } else if (scenario === 'guest-flame') {
      timed('guest-teleport-house', () => F.teleport('house'));
      timed('guest-clear-hostiles', () => g.enemies.clear());
      await runFlame('guest');
    } else if (scenario === 'pilot-districts') {
      await runFlame('pilot');
      routeDistrict('graveyard');
      await runDistrictCase('graveyard');
      routeDistrict('ossuary');
      await runDistrictCase('ossuary');
      await exitOssuary();
      routeDistrict('forest');
      await runDistrictCase('forest');
      routeDistrict('clearing');
      await runDistrictCase('clearing');
      await runWaterfall();
      routeDistrict('cave');
      await runDistrictCase('cave');
    } else throw new Error(`unknown Stage C dynamics scenario ${scenario}`);
  };

  let error = null;
  try { await runScenario(); }
  catch (caught) { error = caught?.stack || caught?.message || `${caught}`; }
  finally {
    const batchSummaries = observedBatchEntries.map(transactionSummary);
    batchAudit = {
      count: batchSummaries.length,
      failures: batchSummaries.filter((entry) => {
        const validity = transactionValidity(entry);
        return !validity.core || !validity.capsValid;
      }),
    };
    assert(batchAudit.count > 0 && batchAudit.failures.length === 0,
      `${scenario} every reduced/exact preload transaction is bounded, committed, and resource-neutral`,
      batchAudit);

    const exactEntries = observedExactEntries.map((entry) => ({
      generation: entry.generation,
      key: entry.key,
      kind: entry.kind,
      durationMs: entry.durationMs,
      subpasses: entry.subpasses || [],
      programDelta: entry.programDelta,
      textureDelta: entry.textureDelta,
      geometryDelta: entry.geometryDelta,
      committed: entry.committed,
      error: entry.error,
    }));
    exactAudit = {
      count: exactEntries.length,
      entries: exactEntries,
      failures: exactEntries.filter((entry) => entry.error != null
        || entry.committed !== true || entry.durationMs >= 100
        || entry.programDelta !== 0 || entry.textureDelta !== 0 || entry.geometryDelta !== 0
        || entry.subpasses.length < 2
        || entry.subpasses.some((subpass) => subpass.durationMs >= 100)),
    };
    assert(exactAudit.count > 0 && exactAudit.failures.length === 0,
      `${scenario} every actual exact certificate and subpass is committed, resource-neutral, and strict sub-100ms`,
      exactAudit);

    const finalizeGroups = new Map();
    for (const entry of observedFinalizePasses) {
      const groupKey = `${entry.generation}|${entry.key}|${entry.scope}`;
      if (!finalizeGroups.has(groupKey)) finalizeGroups.set(groupKey, []);
      finalizeGroups.get(groupKey).push(entry);
    }
    const finalizeEntries = observedFinalizePasses.map((entry) => ({
      generation: entry.generation,
      key: entry.key,
      kind: entry.kind,
      scope: entry.scope,
      scanDurationMs: entry.scanDurationMs,
      recordDurationMs: entry.recordDurationMs,
      durationMs: entry.durationMs,
      recorded: entry.recorded,
      error: entry.error,
      frameId: entry.frameId,
      renderMs: entry.renderMs,
      worldDrawCalls: entry.worldDrawCalls,
      reducedDetail: entry.reducedDetail,
      phaseTimings: entry.phaseTimings,
    }));
    finalizeAudit = {
      count: finalizeEntries.length,
      entries: finalizeEntries,
      failures: finalizeEntries.filter((entry) => entry.error != null
        || entry.scanDurationMs >= 100 || entry.recordDurationMs >= 100
        || entry.durationMs >= 100 || entry.renderMs >= 100
        || entry.worldDrawCalls !== 0),
      incomplete: [...finalizeGroups.entries()]
        .filter(([, entries]) => entries.at(-1)?.recorded !== true)
        .map(([key, entries]) => ({ key, entries: entries.map((entry) => ({
          kind: entry.kind, recorded: entry.recorded, error: entry.error,
        })) })),
    };
    assert(finalizeAudit.count > 0 && finalizeAudit.failures.length === 0
      && finalizeAudit.incomplete.length === 0,
    `${scenario} every owner/deferred final census owns an isolated zero-draw strict sub-100ms paint and converges`,
    finalizeAudit);

    assert(outsideGl.unallocatedBufferSubData === 0
      && outsideGl.bufferAllocationProbeErrors === 0,
    `${scenario} has no unallocated bufferSubData or failed allocation query outside measured renders`,
    outsideGl);
    activeEpisode = null;
    sampling = false;
    pauseDeferred = false;
    trace.restore();
    g.render = realRender;
    g._submitReducedWorldBatch = realBatch;
    g._submitExactCurrentPass = realExact;
    g._prepareOwnerGpuResidency = realOwner;
    g.skull._completeCatch = realCompleteCatch;
    renderer.renderBufferDirect = realRenderBufferDirect;
    for (const restore of cleanup.reverse()) restore();
  }
  return {
    id: scenario,
    status: error ? 'failed' : 'complete',
    error,
    version: F.version,
    generation: g._webglGeneration,
    renderer: rendererName,
    webgl2,
    durationMs: performance.now() - pageStartedAt,
    setupOperations,
    episodes,
    actionOutcomes,
    districtCases,
    outsideGl,
    probeUploads,
    probeVaos,
    probeSubmissions,
    coldVaoEvents,
    actionBindingPreloads,
    actionBindingCertificates,
    actionBindingSubmissions,
    batchAudit,
    exactAudit,
    finalizeAudit,
    observedResidencyErrors,
    observedShaderErrors,
    trace: {
      installed: trace.installed,
      healthyAtRestore: trace.healthyAtRestore,
    },
    residencyErrors: [...(g.currentGpuResidency?.errors || [])],
    shader: {
      status: g.shaderWarmup?.status || null,
      currentExactStatus: g.shaderWarmup?.currentExactStatus || null,
      generation: g.shaderWarmup?.generation ?? null,
      compileJobsInFlight: g.shaderWarmup?.compileJobsInFlight ?? null,
      generationCompileJobsInFlight: g._shaderCompileActivity?.active ?? null,
      generationMaxCompileJobsInFlight: g._shaderCompileActivity?.peak ?? null,
      pendingTextures: g.shaderWarmup?.pendingTextures ?? null,
      errors: [...(g.shaderWarmup?.errors || [])],
    },
    assertions,
  };
}, { scenario, caps: CAPS });

let server = null;
let browser = null;
try {
  server = await ensureServer();
  browser = await launchBrowser();
  report.browser.launches = 1;
  for (const scenario of SCENARIOS) {
    let opened = null;
    const startedAt = performance.now();
    try {
      opened = await openPage(browser, URL);
      await opened.page.waitForFunction(() => window.__FETCH?.ready === true,
        null, { timeout: 90000, polling: 20 });
      const capturePromise = pageCapture(opened.page, scenario);
      let pageTimer = null;
      const timeoutPromise = new Promise((_, reject) => {
        pageTimer = setTimeout(() => reject(
          new Error(`Stage C dynamics page timeout: ${scenario}`)), 420000);
      });
      let capture;
      try { capture = await Promise.race([capturePromise, timeoutPromise]); }
      finally { clearTimeout(pageTimer); }
      capture.bootAndRunMs = performance.now() - startedAt;
      capture.browserErrors = [...opened.errors];
      report.pages[scenario] = cleanRound(capture);
      report.browserErrors.push(...opened.errors.map((error) => `${scenario}: ${error}`));
      report.browser.renderer ||= capture.renderer;
      report.browser.webgl2 ??= capture.webgl2;
    } catch (error) {
      const message = error?.stack || error?.message || `${error}`;
      report.pages[scenario] = { id: scenario, status: 'runner-failed', error: message,
        durationMs: round(performance.now() - startedAt),
        browserErrors: [...(opened?.errors || [])] };
      report.browserErrors.push(...(opened?.errors || [])
        .map((entry) => `${scenario}: ${entry}`));
      failures.push({ message: `${scenario} runner completes`, detail: message });
    } finally {
      try { await opened?.page?.close(); } catch { /* already closed */ }
    }
  }
} catch (error) {
  failures.push({ message: 'Stage C dynamics harness completes',
    detail: error?.stack || error?.message || `${error}` });
} finally {
  try { await browser?.close(); } catch { /* already closed */ }
  try { server?.stop?.(); } catch { /* already stopped */ }
}

check(report.browser.launches === 1,
  'one serial browser owns all three fresh Stage C dynamics pages', report.browser);
check(/(?:D3D11|Direct3D11)/i.test(report.browser.renderer || ''),
  'system Chrome reports real ANGLE D3D11', report.browser.renderer);
check(report.browser.webgl2 === true,
  'Stage C dynamics gate runs on WebGL2', report.browser.webgl2);
for (const scenario of SCENARIOS) {
  const page = report.pages[scenario];
  check(page?.status === 'complete', `${scenario} evaluator completes`, page?.error || null);
  check(page?.trace?.installed === true && page?.trace?.healthyAtRestore === true,
    `${scenario} GL allocation and VAO trace remains healthy through cleanup`, page?.trace);
  check((page?.setupOperations || []).every((entry) =>
    entry.error == null && entry.durationMs < 100),
  `${scenario} setup uses only clean strict sub-100ms synchronous operations`,
  page?.setupOperations);
  check((page?.assertions || []).length > 0
      && (page?.assertions || []).every((entry) => entry.passed),
  `${scenario} passes every focused semantic, timing, and residency assertion`,
  (page?.assertions || []).filter((entry) => !entry.passed));
  check((page?.browserErrors || []).length === 0,
    `${scenario} has zero page and console errors`, page?.browserErrors);
  check((page?.observedResidencyErrors || []).length === 0
      && (page?.residencyErrors || []).length === 0,
  `${scenario} records zero transient or final residency errors`, {
    observed: page?.observedResidencyErrors,
    final: page?.residencyErrors,
  });
  check((page?.observedShaderErrors || []).length === 0
      && (page?.shader?.errors || []).length === 0,
  `${scenario} records zero transient or final shader errors`, {
    observed: page?.observedShaderErrors,
    final: page?.shader?.errors,
  });
}
check(report.browserErrors.length === 0,
  'all three Stage C dynamics pages have zero browser errors', report.browserErrors);

report.durationMs = round(performance.now() - suiteStartedAt);
writeFileSync(resultsPath('transition-stage-c-dynamics-regression.json'),
  JSON.stringify(cleanRound(report), null, 2));
console.log(`RESULT ${failures.length === 0 ? 'PASS' : 'FAIL'} `
  + `transition-stage-c-dynamics-regression (${failures.length} failures)`);
if (failures.length) process.exitCode = 1;

// Focused Stage B D3D11 residency gate.
//
// This deliberately stops exact-world eligibility so the short run measures
// only the reduced playable fallback, its tiny generation bootstrap, grain
// certification, and one context rebootstrap. The broad district/exact/owner
// matrix remains the responsibility of transition-warmup-regression.mjs after
// this gate is green.
//
// Runtime telemetry contract (currentGpuResidency):
//   bootstrapPasses[]: generation, kind (mesh-basic | instanced-basic | grain),
//     durationMs, renderDurationMs, compileSubmitDurationMs,
//     compileMaxSynchronousSliceMs, compileFinalizationDurationMs,
//     program identity, resource deltas, error
//   reducedPasses[]: objects, geometries, geometryBytes, submittedElements,
//     submittedObjects, oversize, isolatedOversize, types, durationMs,
//     programDelta, textureDelta, error
// Runtime visible-grain contract (lastRender):
//   grainSubmitted, grainProgramDelta, grainTextureDelta, grainGeometryDelta
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
const URL = `${URL_BASE}/?test=1&mute=1&warmup=1&warmupRace=1`;
const failures = [];
const report = {
  url: URL,
  port: PORT,
  scope: 'stage-b-reduced-bootstrap-only',
  caps: CAPS,
  renderer: null,
  initial: null,
  restored: null,
  contextSupported: null,
  cloneObservations: [],
  browserErrors: [],
  failures,
};
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};
const round = (value) => Number.isFinite(value) ? +value.toFixed(3) : null;

function validateGeneration(label, stage) {
  check(stage != null, `${label} Stage B capture exists`, stage);
  if (!stage) return;

  const bootstrap = stage.bootstrapPasses || [];
  const relevantBootstrap = bootstrap.filter((entry) =>
    entry.generation === stage.generation);
  for (const kind of ['mesh-basic', 'instanced-basic', 'grain']) {
    const entries = relevantBootstrap.filter((entry) => entry.kind === kind);
    check(entries.length === 1,
      `${label} ${kind} bootstrap submits exactly once in generation ${stage.generation}`,
      entries);
    const entry = entries[0];
    check(entry?.error == null && entry?.durationMs < 100,
      `${label} ${kind} bootstrap is a clean sub-100ms real render`, entry);
    const expectedOwner = kind === 'mesh-basic'
      ? {
          object: 'reduced MeshBasic signature',
          isInstancedMesh: false,
          materialType: 'MeshBasicMaterial',
          cachePrefix: 'basic,',
          volatileCachePrefixFields: 0,
          renderGeometryDelta: 1,
        }
      : kind === 'instanced-basic'
        ? {
            object: 'reduced monochrome InstancedMeshBasic signature',
            isInstancedMesh: true,
            materialType: 'MeshBasicMaterial',
            cachePrefix: 'basic,',
            volatileCachePrefixFields: 0,
            renderGeometryDelta: 0,
          }
        : {
            object: 'grain fullscreen quad',
            isInstancedMesh: false,
            materialType: 'ShaderMaterial',
            cachePrefix: null,
            volatileCachePrefixFields: 2,
            renderGeometryDelta: 1,
          };
    check(entry?.compileSubmitDurationMs < 100
        && entry?.compileMaxReadinessPollDurationMs < 100
        && entry?.compileMaxSynchronousSliceMs < 100
        && entry?.compileCompletionSliceDurationMs < 100
        && entry?.compileFinalizationDurationMs < 100
        && entry?.renderDurationMs < 100,
    `${label} ${kind} preparation and certification slices are each strictly sub-100ms`,
    entry);
    check(entry?.program?.linkStatus === true
        && entry?.program?.diagnosticsMode === 'exact-readiness-plus-link-status'
        && typeof entry?.program?.cacheKey === 'string'
        && entry.program.cacheKey.length > 0
        && typeof entry?.program?.semanticCacheKey === 'string'
        && entry.program.semanticCacheKey.length > 0
        && entry.program.volatileCachePrefixFields
          === expectedOwner.volatileCachePrefixFields
        && Boolean(entry.program.shaderIdentity) === (kind === 'grain')
        && (kind === 'grain'
          ? entry.program.semanticCacheKey
            === entry.program.cacheKey.split(',').slice(2).join(',')
          : entry.program.semanticCacheKey === entry.program.cacheKey)
        && (!expectedOwner.cachePrefix
          || entry.program.cacheKey.startsWith(expectedOwner.cachePrefix))
        && entry?.compileMode === 'compile-plus-exact-readiness-poll'
        && entry?.compileCompletion?.completionMode === 'captured-program-isReady'
        && entry?.compileCompletion?.program?.ready === true
        && entry?.compileCompletion?.program?.id === entry?.program?.id
        && entry?.compileCompletion?.program?.cacheKey === entry?.program?.cacheKey
        && entry?.programOwner?.object === expectedOwner.object
        // Three r161 intentionally inherits Mesh.type for InstancedMesh; the
        // dedicated boolean is the authoritative runtime class identity.
        && entry?.programOwner?.objectType === 'Mesh'
        && entry?.programOwner?.isMesh === true
        && entry?.programOwner?.isInstancedMesh === expectedOwner.isInstancedMesh
        && entry?.programOwner?.materialType === expectedOwner.materialType,
    `${label} ${kind} bootstrap names and validates exactly its owned program`, {
      program: entry?.program,
      owner: entry?.programOwner,
    });
    check(entry?.compileProgramDelta === 1
        && entry?.compileTextureDelta === 0
        && entry?.compileGeometryDelta === 0
        && entry?.renderProgramDelta === 0
        && entry?.renderTextureDelta === 0
        && entry?.renderGeometryDelta === expectedOwner.renderGeometryDelta,
    `${label} ${kind} preparation and certification resource ownership is exact`,
    entry);
  }
  check(stage.bootstrapGeneration == null
      || stage.bootstrapGeneration === stage.generation,
  `${label} bootstrap telemetry belongs to the live GL generation`, {
    generation: stage.generation,
    bootstrapGeneration: stage.bootstrapGeneration,
  });
  check(stage.bootstrapStatus == null || stage.bootstrapStatus === 'ready',
    `${label} tiny bootstrap reaches ready`, stage.bootstrapStatus);

  const frames = stage.frames || [];
  const allReducedFrames = frames.filter((frame) => frame.reducedDetail);
  const reducedFrames = frames.filter((frame) =>
    frame.reducedDetail && frame.worldDrawCalls > 0);
  check(stage.firstSilhouetteMs != null
      && stage.firstSilhouetteMs <= 150,
  `${label} produces a nonzero physical silhouette inside its reveal budget`, {
    firstSilhouetteMs: stage.firstSilhouetteMs,
    budgetMs: 150,
  });
  check(reducedFrames.length > 0,
    `${label} visibly exercises the reduced physical fallback`, {
      reducedFrames: reducedFrames.length,
    });
  check(frames.every((frame) => frame.shielded === false),
    `${label} never enables the opaque shader transition shield`,
    frames.filter((frame) => frame.shielded));
  check(frames.every((frame) => frame.renderMs <= 100),
    `${label} every visible render stays at or below 100ms`, {
      maxRenderMs: Math.max(0, ...frames.map((frame) => frame.renderMs)),
      slow: frames.filter((frame) => frame.renderMs > 100),
    });
  check((stage.rafIntervals || []).every((duration) => duration <= 100),
    `${label} every visible rAF interval stays at or below 100ms`, {
      maxRafMs: Math.max(0, ...(stage.rafIntervals || [])),
      slow: (stage.rafIntervalDetails || [])
        .filter((entry) => entry.durationMs > 100),
    });
  check(allReducedFrames.every((frame) => frame.visibleProgramDelta === 0
      && frame.visibleTextureDelta === 0 && frame.visibleGeometryDelta === 0),
  `${label} reduced visible frames create zero programs, textures, or geometries`,
  allReducedFrames.filter((frame) => frame.visibleProgramDelta !== 0
      || frame.visibleTextureDelta !== 0 || frame.visibleGeometryDelta !== 0));

  const batches = stage.reducedPasses || [];
  check(batches.length > 0, `${label} submits at least one hidden reduced batch`, batches);
  for (const [index, batch] of batches.entries()) {
    const detail = { index, ...batch };
    check(batch.error == null && batch.programDelta === 0
        && batch.textureDelta === 0 && batch.durationMs <= 100,
    `${label} hidden batch ${index + 1} is zero-program/texture and sub-100ms`, detail);
    check(batch.types?.lines === 0 && batch.types?.points === 0,
      `${label} hidden batch ${index + 1} omits decorative Line and Points fallbacks`,
      detail);
    check(Number.isFinite(batch.submittedObjects)
        && batch.submittedObjects === batch.objects,
    `${label} hidden batch ${index + 1} transient submission equals this batch, not accumulated silhouettes`,
    detail);
    check(Number.isFinite(batch.geometryBytes)
        && Number.isFinite(batch.submittedElements),
    `${label} hidden batch ${index + 1} reports byte and submitted-element accounting`,
    detail);

    const withinCaps = batch.geometries <= CAPS.geometries
      && batch.objects <= CAPS.objects
      && batch.geometryBytes <= CAPS.bytes
      && batch.submittedElements <= CAPS.elements;
    if (withinCaps) {
      check(batch.objects > 0 && batch.oversize == null
          && batch.isolatedOversize !== true,
      `${label} hidden batch ${index + 1} is an ordinary admitted batch`, detail);
    } else {
      const oversize = batch.oversize;
      check(batch.objects === 1 && batch.submittedObjects === 1
          && batch.geometries === 1 && batch.isolatedOversize === true
          && oversize != null
          && Boolean(oversize.object || oversize.name || oversize.objectUuid)
          && Boolean(oversize.reason),
      `${label} oversize batch ${index + 1} is one named resource in complete isolation`,
      detail);
    }
  }

  const grainFrames = frames.filter((frame) => frame.grainSubmitted);
  check(frames.every((frame) => !frame.grainSubmitted || frame.grainCertified),
    `${label} withholds production grain until a same-generation hidden certification exists`,
    frames.filter((frame) => frame.grainSubmitted && !frame.grainCertified));
  check(frames.every((frame) => frame.bootstrapKind !== 'grain' || !frame.grainSubmitted),
    `${label} grain certification owns its paint before the first visible grain draw`,
    frames.filter((frame) => frame.bootstrapKind === 'grain' && frame.grainSubmitted));
  check(grainFrames.length > 0,
    `${label} eventually reveals certified production grain`, {
      grainFrames: grainFrames.length,
    });
  const firstGrain = grainFrames[0];
  check(firstGrain?.grainProgramDelta === 0
      && firstGrain?.grainTextureDelta === 0
      && firstGrain?.grainGeometryDelta === 0,
  `${label} first visible grain frame creates zero programs, textures, or geometries`,
  firstGrain);
}

let server = null;
let browser = null;
let opened = null;
try {
  server = await ensureServer();
  browser = await launchBrowser();
  opened = await openPage(browser, URL, { width: 1280, height: 720 });
  const { page } = opened;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game?.renderer,
    null, { timeout: 90000, polling: 50 },
  );

  const capture = await page.evaluate(async ({ caps }) => {
    const g = window.__game;
    const F = window.__FETCH;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const waitFor = async (predicate, label, timeout = 90000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) await frame();
      if (!predicate()) throw new Error(`Stage B timed out waiting for ${label}`);
    };
    const stats = () => ({
      programs: g.renderer.info.programs?.length || 0,
      textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries,
    });
    const cloneValue = (value) => JSON.parse(JSON.stringify(value));
    const bootstrapFor = (generation) =>
      [...(g.currentGpuResidency?.bootstrapPasses || [])]
        .filter((entry) => entry.generation === generation);
    const hasBootstrap = (generation, kind) => bootstrapFor(generation)
      .some((entry) => entry.kind === kind && entry.error == null);
    const batchesFor = () => [...(g.currentGpuResidency?.reducedPasses || [])]
      .filter((entry) => /batch$/.test(entry.kind || '') && entry.objects > 0);
    const reducedComplete = () => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      return progress?.snapshotReady && progress.queue.length === 0
        && residency.reduced?.has(progress.key);
    };
    const stageReady = (generation, stageFrames) => reducedComplete()
      && hasBootstrap(generation, 'mesh-basic')
      && hasBootstrap(generation, 'instanced-basic')
      && hasBootstrap(generation, 'grain')
      && stageFrames.some((entry) => entry.reducedDetail && entry.worldDrawCalls > 0)
      && stageFrames.some((entry) => entry.grainSubmitted);

    const gl = g.renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = rendererInfo
      ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    const lose = gl.getExtension('WEBGL_lose_context');
    const canvas = g.renderer.domElement;
    const contextEvent = (name, action) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`missing ${name}`)), 20000);
      canvas.addEventListener(name, () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      action();
    });

    // This is a Stage B isolation gate. Prevent the following paint from
    // entering Stage C's exact-world certification once the reduced queue is
    // drained; the production method is restored before this evaluator exits.
    const realPhysicalVariantReady = g._currentPhysicalVariantReady;
    g._currentPhysicalVariantReady = () => false;

    const cloneObservations = [];
    const realCloneReduced = g._cloneReducedRenderable;
    g._cloneReducedRenderable = function observedReducedClone(object, options) {
      const clone = realCloneReduced.call(this, object, options);
      if (clone?.isInstancedMesh) {
        cloneObservations.push({
          generation: g._webglGeneration,
          source: object.name || object.uuid,
          sourceUuid: object.uuid,
          instanceColorPresent: clone.instanceColor != null,
          materialType: clone.material?.type || null,
        });
      }
      return clone;
    };

    const frames = [];
    const intervals = [];
    let previousRaf = null;
    let previousRafAt = null;
    let stageLabel = 'prestart';
    let sampling = true;
    const sampleRaf = (timestamp) => {
      if (previousRaf != null) {
        const at = performance.now();
        intervals.push({
          fromAt: previousRafAt,
          at,
          fromTimestamp: previousRaf,
          timestamp,
          stage: stageLabel,
          durationMs: timestamp - previousRaf,
        });
        previousRafAt = at;
      } else {
        previousRafAt = performance.now();
      }
      previousRaf = timestamp;
      if (sampling) requestAnimationFrame(sampleRaf);
    };
    requestAnimationFrame(sampleRaf);

    const realRender = g.render;
    g.render = function measuredStageBRender(...args) {
      const before = stats();
      const startedAt = performance.now();
      try { return realRender.apply(this, args); }
      finally {
        const after = stats();
        const generation = g._webglGeneration;
        frames.push({
          stage: stageLabel,
          generation,
          startedAt,
          completedAt: performance.now(),
          renderMs: performance.now() - startedAt,
          worldDrawCalls: g.lastRender?.worldDrawCalls || 0,
          reducedDetail: !!g.lastRender?.reducedDetail,
          shielded: !!g._shaderTransitionShield,
          visibleProgramDelta: g.lastRender?.visibleProgramDelta || 0,
          visibleTextureDelta: g.lastRender?.visibleTextureDelta || 0,
          visibleGeometryDelta: g.lastRender?.visibleGeometryDelta || 0,
          rawProgramDelta: after.programs - before.programs,
          rawTextureDelta: after.textures - before.textures,
          rawGeometryDelta: after.geometries - before.geometries,
          grainCertified: hasBootstrap(generation, 'grain'),
          grainSubmitted: !!g.lastRender?.grainSubmitted,
          grainProgramDelta: g.lastRender?.grainProgramDelta ?? null,
          grainTextureDelta: g.lastRender?.grainTextureDelta ?? null,
          grainGeometryDelta: g.lastRender?.grainGeometryDelta ?? null,
          bootstrapKind: g.lastRender?.bootstrapKind ?? null,
        });
      }
    };

    const summarize = (label, generation, startedAt, endedAt) => {
      const stageFrames = frames.filter((entry) => entry.stage === label
        && entry.generation === generation && entry.completedAt >= startedAt
        && entry.startedAt <= endedAt);
      const stageIntervalDetails = intervals.filter((entry) => entry.stage === label
        && entry.at >= startedAt && entry.at <= endedAt);
      const firstSilhouette = stageFrames.find((entry) =>
        entry.reducedDetail && entry.worldDrawCalls > 0);
      return {
        generation,
        bootstrapGeneration: g.currentGpuResidency?.bootstrapGeneration ?? null,
        bootstrapStatus: g.currentGpuResidency?.bootstrapStatus ?? null,
        bootstrapPasses: cloneValue(bootstrapFor(generation)),
        reducedPasses: cloneValue(batchesFor()),
        firstSilhouetteMs: firstSilhouette
          ? firstSilhouette.completedAt - startedAt : null,
        frames: cloneValue(stageFrames),
        rafIntervals: cloneValue(stageIntervalDetails.map((entry) => entry.durationMs)),
        rafIntervalDetails: cloneValue(stageIntervalDetails),
      };
    };

    let initial = null;
    let restored = null;
    let clickMs = null;
    const contextSupported = !!lose;
    try {
      await frame();
      const initialGeneration = g._webglGeneration;
      stageLabel = 'initial';
      const wakeAt = performance.now();
      const clickAt = performance.now();
      F.start();
      clickMs = performance.now() - clickAt;
      g._selfStep = false;
      F.teleport('house');
      await waitFor(() => stageReady(initialGeneration,
        frames.filter((entry) => entry.stage === 'initial')),
      'initial reduced bootstrap, silhouette, batches, and grain');
      const initialEndedAt = performance.now();
      initial = summarize('initial', initialGeneration, wakeAt, initialEndedAt);
      initial.clickMs = clickMs;

      if (lose) {
        stageLabel = 'context-lost';
        await contextEvent('webglcontextlost', () => lose.loseContext());
        await new Promise((resolve) => setTimeout(resolve, 50));
        await contextEvent('webglcontextrestored', () => lose.restoreContext());
        const restoredGeneration = g._webglGeneration;
        // Exclude the intentionally lost-context wall-clock gap. The next
        // interval begins with the first paint opportunity in the new GL
        // generation and is therefore a real visible-frame sample.
        previousRaf = null;
        previousRafAt = null;
        stageLabel = 'restored';
        const restoredAt = performance.now();
        g._selfStep = false;
        await waitFor(() => stageReady(restoredGeneration,
          frames.filter((entry) => entry.stage === 'restored')),
        'restored reduced bootstrap, silhouette, batches, and grain');
        const restoredEndedAt = performance.now();
        restored = summarize('restored', restoredGeneration, restoredAt, restoredEndedAt);
      }
    } finally {
      sampling = false;
      g.render = realRender;
      g._cloneReducedRenderable = realCloneReduced;
      g._currentPhysicalVariantReady = realPhysicalVariantReady;
      await frame();
    }

    return {
      caps,
      renderer,
      contextSupported,
      initial,
      restored,
      cloneObservations,
    };
  }, { caps: CAPS });

  report.renderer = capture.renderer;
  report.contextSupported = capture.contextSupported;
  report.initial = capture.initial;
  report.restored = capture.restored;
  report.cloneObservations = capture.cloneObservations;
  report.browserErrors = [...opened.errors];

  check(/(?:D3D11|Direct3D11)/i.test(report.renderer || ''),
    'system Chrome reports the real ANGLE D3D11 renderer', report.renderer);
  check(report.initial?.clickMs < 50,
    'Wake click returns in under 50ms', report.initial?.clickMs);
  check(report.contextSupported === true,
    'WEBGL_lose_context is available for Stage B rebootstrap coverage');
  validateGeneration('initial', report.initial);
  validateGeneration('restored', report.restored);
  for (const kind of ['mesh-basic', 'instanced-basic', 'grain']) {
    const initialProgram = report.initial?.bootstrapPasses?.find((entry) => entry.kind === kind)
      ?.program;
    const restoredProgram = report.restored?.bootstrapPasses?.find((entry) => entry.kind === kind)
      ?.program;
    const exactShaderIdentity = JSON.stringify(initialProgram?.shaderIdentity)
      === JSON.stringify(restoredProgram?.shaderIdentity);
    check(initialProgram?.semanticCacheKey
      && initialProgram.semanticCacheKey === restoredProgram?.semanticCacheKey
      && exactShaderIdentity
      && (kind === 'grain'
        || initialProgram.cacheKey === restoredProgram?.cacheKey),
    `initial and restored generations certify the identical ${kind} semantic program`, {
      initialRawCacheKey: initialProgram?.cacheKey,
      restoredRawCacheKey: restoredProgram?.cacheKey,
      initialSemanticCacheKey: initialProgram?.semanticCacheKey,
      restoredSemanticCacheKey: restoredProgram?.semanticCacheKey,
      exactShaderIdentity,
    });
  }
  check(report.restored?.generation > report.initial?.generation,
    'context restore advances to a new GL generation', {
      initial: report.initial?.generation,
      restored: report.restored?.generation,
    });
  check(report.cloneObservations.length > 0
      && report.cloneObservations.every((entry) =>
        entry.instanceColorPresent === false && entry.materialType === 'MeshBasicMaterial'),
  'reduced InstancedMesh clones are monochrome MeshBasic with instanceColor removed',
  report.cloneObservations);
  check(report.browserErrors.length === 0,
    'Stage B browser run emits zero page or console errors', report.browserErrors);
} catch (error) {
  failures.push({
    message: 'Stage B suite crashed',
    detail: error?.stack || error?.message || `${error}`,
  });
} finally {
  await opened?.page?.close().catch(() => {});
  await browser?.close().catch(() => {});
  server?.stop();
}

const cleanRound = (value) => {
  if (Array.isArray(value)) {
    for (const item of value) cleanRound(item);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/(?:Ms|duration)$/i.test(key) && Number.isFinite(item)) value[key] = round(item);
      else cleanRound(item);
    }
  }
};
cleanRound(report);
writeFileSync(resultsPath('transition-stage-b-regression.json'), JSON.stringify(report, null, 2));

if (failures.length) {
  console.error(`\n${failures.length} Stage B transition regression(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nSTAGE B TRANSITION RESIDENCY PASS');
}

// Focused Stage C cave/Finale context-residency gate.
//
// One real D3D11 page owns two distinct context restorations: first while the
// sacrificed-skull route is physically in Underfalls, then while the Finale is
// active and its four reflection targets are live. This intentionally does not
// cover district promotion, action churn, or mirror fault injection.
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
const failures = [];
const report = {
  url: URL,
  port: PORT,
  scope: 'stage-c-cave-finale-context-exact',
  caps: CAPS,
  renderer: null,
  webgl2: null,
  contextSupported: null,
  route: null,
  caveInitial: null,
  caveRestored: null,
  finaleInitial: null,
  finaleRestored: null,
  browserErrors: [],
  failures,
};
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};
const round = (value) => Number.isFinite(value) ? +value.toFixed(3) : null;
const sorted = (values) => [...(values || [])].sort();
const equalSorted = (left, right) =>
  JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const exactP16 = (census) => census?.total === 20
  && census?.byType?.AmbientLight === 1
  && census?.byType?.HemisphereLight === 1
  && census?.byType?.DirectionalLight === 1
  && census?.byType?.SpotLight === 1
  && census?.byType?.PointLight === 16
  && census?.totalShadows === 1
  && census?.directionalShadows === 1;

function validateBatch(label, batch, targetOwner = null) {
  check(batch.error == null && batch.durationMs < 100,
    `${label} ${batch.kind} #${batch.batch} is clean and strictly sub-100ms`, batch);
  check(batch.programDelta === 0 && batch.textureDelta === 0
      && batch.geometryDelta >= 0 && batch.geometryDelta <= batch.geometries
      && batch.programIdentityCount === 0,
  `${label} ${batch.kind} #${batch.batch} owns no cold or replacement program/texture`, batch);
  check(batch.committed === true && batch.stateRestored === true
      && batch.generationStable === true && batch.fingerprintsStable === true
      && batch.queuePrefixStable === true && batch.persistentObjectsAdded === 0,
  `${label} ${batch.kind} #${batch.batch} commits one restored stable transaction`, batch);
  const withinCaps = batch.geometries <= CAPS.geometries
    && batch.objects <= CAPS.objects
    && batch.geometryBytes <= CAPS.bytes
    && batch.submittedElements <= CAPS.elements;
  check(withinCaps
    ? batch.oversize == null && batch.isolatedOversize !== true
    : batch.objects === 1 && batch.geometries === 1
      && batch.isolatedOversize === true && Boolean(batch.oversize?.reason)
      && Boolean(batch.oversize?.object || batch.oversize?.name
        || batch.oversize?.objectUuid),
  `${label} ${batch.kind} #${batch.batch} is capped or one named isolated oversize`, batch);
  if (targetOwner) {
    check(batch.targetOwner === targetOwner && Boolean(batch.targetUuid),
      `${label} ${batch.kind} #${batch.batch} binds the named ${targetOwner} target`, batch);
  }
}

function validatePhysical(label, stage, expectedAct) {
  check(stage != null, `${label} capture exists`, stage ? {
    generation: stage.generation, key: stage.key, act: stage.act,
  } : null);
  if (!stage) return;
  const perf = stage.performance;
  check(stage.act === expectedAct && stage.route.waterfallTaken === true
      && stage.route.skullMode === 'gone' && stage.route.skullParent == null
      && stage.route.tetherVisible === false,
  `${label} preserves the natural sacrificed-skull ${expectedAct} state`, {
    act: stage.act, route: stage.route,
  });
  check(perf.frames > 0 && perf.slowFrames.length === 0 && perf.maxRenderMs < 100,
    `${label} every captured render is strictly below 100ms`, perf);
  check(perf.rafIntervals > 0 && perf.slowRafs.length === 0 && perf.maxRafMs < 100,
    `${label} every in-generation rAF interval is strictly below 100ms`, perf);
  check(perf.stageToFirstObservedRafMs != null
      && perf.stageToFirstObservedRafMs < 100,
  `${label} reaches its first observed browser paint in strictly below 100ms`, {
    stageToFirstObservedRafMs: perf.stageToFirstObservedRafMs,
    rafBoundarySamples: perf.rafBoundarySamples,
  });
  if (perf.restoration) {
    check(perf.restoration.error == null
        && perf.restoration.restoreEventDurationMs < 100,
    `${label} owns a complete strict sub-100ms context-restoration handler`,
    perf.restoration);
  }
  check(perf.shieldedFrames === 0 && perf.visibleResourceFrames.length === 0,
    `${label} delivers no shielded or cold-resource visible frame`, perf);

  const surface = (stage.surfacePasses || []).filter((entry) =>
    entry.generation === stage.generation
      && entry.kind === 'default-surface-clear-fence');
  check(surface.length === 1 && surface[0].error == null
      && surface[0].status === 'ready'
      && surface[0].durationMs < 100
      && surface[0].submitDurationMs < 100
      && surface[0].maxPollDurationMs < 100
      && surface[0].maxSynchronousSliceMs < 100
      && surface[0].programDelta === 0
      && surface[0].textureDelta === 0
      && surface[0].geometryDelta === 0
      && surface[0].stateRestored === true
      && surface[0].generationStable === true,
  `${label} owns one clean resource-neutral strict sub-100ms surface activation`, surface);
  const bootstrap = (stage.bootstrapPasses || []).filter((entry) =>
    entry.generation === stage.generation);
  check(bootstrap.length === 3,
    `${label} owns exactly the three Stage B bootstrap signatures`, bootstrap);
  for (const kind of ['mesh-basic', 'instanced-basic', 'grain']) {
    const entries = bootstrap.filter((entry) => entry.kind === kind);
    const expectedGeometry = kind === 'instanced-basic' ? 0 : 1;
    check(entries.length === 1 && entries[0].error == null
        && entries[0].durationMs < 100
        && entries[0].renderDurationMs < 100
        && entries[0].compileSubmitDurationMs < 100
        && entries[0].compileFinalizationDurationMs < 100
        && entries[0].compileMaxSynchronousSliceMs < 100
        && entries[0].programDelta === 1
        && entries[0].textureDelta === 0
        && entries[0].geometryDelta === expectedGeometry
        && entries[0].compileProgramDelta === 1
        && entries[0].compileTextureDelta === 0
        && entries[0].compileGeometryDelta === 0
        && entries[0].renderProgramDelta === 0
        && entries[0].renderTextureDelta === 0
        && entries[0].renderGeometryDelta === expectedGeometry
        && entries[0].program?.linkStatus === true
        && Boolean(entries[0].program?.semanticCacheKey)
        && Boolean(entries[0].programOwner?.object)
        && entries[0].compileCompletion?.program?.ready === true,
    `${label} ${kind} bootstrap is exactly-once, exact-identity, exact-resource, and strict sub-100ms`,
    entries);
  }

  const snapshots = stage.snapshotPasses || [];
  const expectedSnapshotPhases = expectedAct === 'mirror'
    ? ['current', 'owner-primary', 'owner-secondary']
    : ['current', 'deferred'];
  check(snapshots.length === expectedSnapshotPhases.length
      && equalSorted(snapshots.map((entry) => entry.phase),
        expectedSnapshotPhases)
      && snapshots.every((entry) => entry.error == null && entry.durationMs < 100
        && Object.values(entry.phases || {}).every((durationMs) => durationMs < 100))
      && snapshots.at(-1)?.complete === true,
  `${label} owns its exact clean snapshot itinerary with every phase strictly sub-100ms`,
  snapshots);
  for (const batch of stage.reducedPasses || []) {
    const withinCaps = batch.geometries <= CAPS.geometries
      && batch.objects <= CAPS.objects
      && batch.geometryBytes <= CAPS.bytes
      && batch.submittedElements <= CAPS.elements;
    check(batch.error == null && batch.durationMs < 100
        && batch.programDelta === 0 && batch.textureDelta === 0
        && batch.geometryDelta >= 0 && batch.geometryDelta <= batch.geometries
        && batch.types?.lines === 0 && batch.types?.points === 0
        && batch.committed === true && batch.stateRestored === true
        && batch.generationStable === true && batch.fingerprintsStable === true
        && batch.queuePrefixStable === true
        && (withinCaps
          ? batch.oversize == null && batch.isolatedOversize !== true
          : batch.objects === 1 && batch.geometries === 1
            && batch.isolatedOversize === true && Boolean(batch.oversize?.reason))
        && (batch.visibleObjects === 0
          || (batch.visibleObjects === batch.persistentObjectsAdded
            && batch.physicalRevealDeferred === true
            && batch.pendingPhysicalRevealObjects === batch.persistentObjectsAdded)),
    `${label} ${batch.kind} #${batch.batch} is capped, transactional, program/texture-neutral, and strict sub-100ms`,
    batch);
  }
  check((stage.reducedPasses || []).length > 0,
    `${label} records its hidden reduced preload transactions`, {
      count: stage.reducedPasses?.length || 0,
    });

  const exact = stage.exactPasses;
  check(exact.length === 1 && exact[0].rendered !== false && exact[0].error == null
      && exact[0].durationMs < 100 && exact[0].programDelta === 0
      && exact[0].textureDelta === 0 && exact[0].geometryDelta === 0,
  `${label} owns one clean strict sub-100ms +0/+0/+0 exact certificate`, exact);
  const pass = exact[0];
  check(equalSorted(pass?.programSubpasses, ['grain', 'world'])
      && equalSorted(pass?.geometrySubpasses, ['grain', 'world'])
      && pass?.geometryUploads === 0 && pass?.geometryChanges === 0
      && pass?.bufferHooksInstalled === true,
  `${label} certifies exactly world+grain with no held-skull or buffer mutation`, pass);
  check(perf.exactCertificateFrameId != null && perf.firstFullFrameId != null
      && perf.firstFullFrameId > perf.exactCertificateFrameId
      && perf.exactCertificateGl.bufferData === 0
      && perf.exactCertificateGl.bufferSubData === 0
      && perf.exactCertificateGl.createVertexArray === 0
      && perf.firstFullGl.bufferData === 0
      && perf.firstFullGl.bufferSubData === 0
      && perf.firstFullGl.createVertexArray === 0,
  `${label} separates hidden certification from a zero-allocation later full paint`, perf);
  const visibleGl = perf.glByPhase['visible-render'] || {
    bufferData: 0, bufferSubData: 0, unallocatedBufferSubData: 0,
    bufferAllocationProbeErrors: 0, createVertexArray: 0,
  };
  check(visibleGl.bufferData === 0 && visibleGl.unallocatedBufferSubData === 0
      && visibleGl.bufferAllocationProbeErrors === 0
      && visibleGl.createVertexArray === 0,
  `${label} performs no late buffer allocation, unallocated mutation, or VAO creation in visible renders`,
  visibleGl);
  check(Object.values(perf.glByPhase).every((counts) =>
    counts.bufferAllocationProbeErrors === 0),
  `${label} every dynamic-buffer allocation probe succeeds`, perf.glByPhase);

  check(stage.currentCoverage.exactQueue === 0
      && stage.currentCoverage.exactCovered === stage.currentCoverage.exactUniverse
      && stage.currentCoverage.allCommitted === true
      && stage.currentCoverage.failedObjects.length === 0
      && stage.currentCoverage.blockedCritical === false,
  `${label} closes and commits its full current exact universe`, stage.currentCoverage);
  stage.exactPreloadPasses
    .filter((entry) => entry.kind === 'current-exact-preload-batch')
    .forEach((entry) => validateBatch(label, entry));
  check(stage.exactPreloadPasses.some((entry) =>
    entry.kind === 'current-exact-preload-batch'),
  `${label} exercises the real current exact preload lane`, {
    count: stage.exactPreloadPasses.filter((entry) =>
      entry.kind === 'current-exact-preload-batch').length,
  });
  check(stage.exactScanPasses.length > 0
      && stage.exactScanPasses.every((entry) => entry.error == null
        && entry.durationMs < 100)
      && stage.exactScanPasses.filter((entry) => entry.scope === 'critical').at(-1)?.stable
      && stage.exactScanPasses.filter((entry) => entry.scope === 'critical').at(-1)?.queued === 0,
  `${label} exact fingerprint scans are clean, stable, and strictly sub-100ms`,
  stage.exactScanPasses);
  check(exactP16(stage.worldLightCensus),
    `${label} physical camera owns exact A1/H1/D1/S1/P16 with one shadow`,
    stage.worldLightCensus);
  const requiredShaderVariants = expectedAct === 'cave'
    ? ['cave-lights', 'grain', 'current-view-exact']
    : ['finale-world', 'reflection-target', 'grain', 'current-view-exact'];
  check(stage.shader.status === 'ready' && stage.shader.errors.length === 0
      && stage.shader.generation === stage.generation
      && stage.shader.currentExactStatus === 'ready'
      && stage.shader.currentExactUniverse === stage.currentCoverage.exactUniverse
      && stage.shader.currentExactRoots > 0
      && stage.shader.currentExactRepresentatives > 0
      && stage.shader.compileJobsInFlight === 0
      && stage.shader.pendingTextures === 0
      && Number.isFinite(stage.shader.completedAt)
      && Number.isFinite(stage.shader.durationMs)
      && stage.shader.operations.length > 0
      && stage.shader.readyVariants.includes('grain')
      && stage.shader.readyVariants.includes('current-view-exact')
      && requiredShaderVariants.every((variant) =>
        stage.shader.readyVariants.includes(variant))
      && stage.shader.currentExactKey === stage.key
      && stage.shader.currentExactRevision === stage.currentCoverage.exactShaderRevision,
  `${label} shader readiness is keyed to this exact universe revision`, {
    requiredShaderVariants,
    status: stage.shader.status,
    readyVariants: stage.shader.readyVariants,
    currentExactKey: stage.shader.currentExactKey,
    currentExactRevision: stage.shader.currentExactRevision,
    expectedKey: stage.key,
    expectedRevision: stage.currentCoverage.exactShaderRevision,
    errors: stage.shader.errors,
  });
  check(requiredShaderVariants.every((variant) =>
    stage.shader.carriedReadyVariants.includes(variant)
      || stage.shader.operations.some((entry) => entry.label?.includes(variant))),
  `${label} has current-generation operation or carried-resident provenance for every required shader variant`, {
    requiredShaderVariants,
    carriedReadyVariants: stage.shader.carriedReadyVariants,
    operationLabels: stage.shader.operations.map((entry) => entry.label),
  });
  check(stage.shader.operations.every((entry) => entry.error == null
      && entry.invalidated !== true && entry.maxSynchronousSliceMs < 100),
  `${label} every recorded shader operation has a strict sub-100ms synchronous slice`,
  stage.shader.operations.filter((entry) => entry.error != null
    || entry.invalidated === true || !(entry.maxSynchronousSliceMs < 100)));
  check(stage.residencyErrors.length === 0,
    `${label} residency telemetry has zero errors`, stage.residencyErrors);
  check(stage.productionSummaryOperations.every((entry) =>
    entry.error == null && entry.durationMs < 100),
  `${label} production helpers used by final capture are individually strict sub-100ms`,
  stage.productionSummaryOperations);
}

function validateFinale(label, stage) {
  validatePhysical(label, stage, 'mirror');
  if (!stage) return;
  const expected = stage.expectedOwner;
  const universe = stage.ownerUniverse;
  check(expected.intersection.length === 0
      && equalSorted(universe?.members, expected.reduced)
      && equalSorted(universe?.coveredMembers, expected.reduced)
      && equalSorted(universe?.exactOnlyMembers, expected.exactOnly)
      && equalSorted(universe?.exactMembers, expected.all)
      && equalSorted(universe?.exactCoveredMembers, expected.all)
      && universe?.covered === universe?.total
      && universe?.exactCovered === universe?.exactTotal,
  `${label} partitions and covers reduced Mesh plus exact-only Line/Points ownership`, {
    expected: { reduced: expected.reduced.length, exactOnly: expected.exactOnly.length,
      all: expected.all.length, intersection: expected.intersection },
    universe: universe ? { total: universe.total, covered: universe.covered,
      exactOnlyDecorative: universe.exactOnlyDecorative,
      exactTotal: universe.exactTotal, exactCovered: universe.exactCovered } : null,
  });
  check(stage.visibilityIsolation?.active === true
      && stage.visibilityIsolation?.runs >= 1
      && stage.visibilityIsolation?.roots > 0
      && stage.visibilityIsolation?.renderables > 0
      && stage.visibilityIsolation?.allHidden === true
      && stage.visibilityIsolation?.durationMs < 100
      && stage.finishedDistrictRoots?.total === stage.finishedDistrictRoots?.hidden
      && stage.finishedDistrictRoots?.visible?.length === 0
      && stage.reflectionVisible?.members?.length > 0
      && stage.reflectionVisible?.unowned?.length === 0
      && stage.reflectionVisible?.uncovered?.length === 0,
  `${label} synchronously isolates finished districts and leaves no unowned reflection-visible renderable`, {
    isolation: stage.visibilityIsolation,
    finishedDistrictRoots: stage.finishedDistrictRoots,
    reflectionVisible: {
      members: stage.reflectionVisible?.members?.length,
      unowned: stage.reflectionVisible?.unowned,
      uncovered: stage.reflectionVisible?.uncovered,
    },
  });
  const ownerBatches = stage.exactPreloadPasses.filter((entry) =>
    entry.kind === 'owner-exact-preload-batch');
  check(ownerBatches.length > 0 && ownerBatches.every((entry) =>
    entry.targetUuid === stage.target.poolTextureUuids[0]),
  `${label} owner exact batches all bind the live first Finale target`, {
    expectedTarget: stage.target.poolTextureUuids[0],
    targets: [...new Set(ownerBatches.map((entry) => entry.targetUuid))],
  });
  ownerBatches.forEach((entry) => validateBatch(label, entry, 'finale'));
  check(stage.ownerPasses.length === 1 && stage.ownerPasses[0].kind === 'finale'
      && stage.ownerPasses[0].key === stage.ownerKey
      && stage.ownerPasses[0].rendered === true && stage.ownerPasses[0].error == null
      && stage.ownerPasses[0].durationMs < 100
      && stage.ownerPasses[0].programDelta === 0
      && stage.ownerPasses[0].textureDelta === 0
      && stage.ownerPasses[0].geometryDelta === 0,
  `${label} owns one clean strict sub-100ms +0/+0/+0 Finale certificate`,
  stage.ownerPasses);
  check(stage.performance.ownerCertificateFrameId != null
      && stage.performance.firstPaneFrameId > stage.performance.ownerCertificateFrameId
      && stage.performance.ownerCertificateGl.bufferData === 0
      && stage.performance.ownerCertificateGl.bufferSubData === 0
      && stage.performance.ownerCertificateGl.createVertexArray === 0
      && stage.performance.firstPaneGl.bufferData === 0
      && stage.performance.firstPaneGl.bufferSubData === 0
      && stage.performance.firstPaneGl.createVertexArray === 0,
  `${label} separates hidden Finale owner certification from the later pane reveal`,
  stage.performance);
  check(stage.target.status === 'ready' && stage.target.generation === stage.generation
      && stage.target.warmed === 4 && stage.target.budget === 4
      && stage.target.poolLength === 4 && stage.target.poolRefMatches === true
      && stage.target.targetRefsMatch === true
      && stage.target.failedTargets.length === 0 && stage.target.errors.length === 0
      && stage.target.maxSliceMs < 100
      && stage.target.poolSignature === stage.target.livePoolSignature,
  `${label} re-earns all four exact target identities in bounded slices`, stage.target);
  check(stage.ownerKey.startsWith(`${stage.generation}:finale:epoch`)
      && stage.ownerKey.includes(':budget4:') && stage.ownerKey.includes(':size')
      && !/missing|no-texture/.test(stage.ownerKey),
  `${label} owner key contains generation, pool epoch, budget, size, and texture identity`,
  stage.ownerKey);
  check(stage.panes.activeCount > 0 && stage.panes.textureUuids.length > 0
      && stage.panes.reflectMasks.length === 4
      && stage.panes.reflectMasks.every((mask) => mask === 9)
      && stage.panes.reflectMaskUnion === 9
      && stage.panes.virtualCameraMask === 9
      && stage.panes.textureUuids.every((uuid) =>
        stage.target.poolTextureUuids.includes(uuid)),
  `${label} live panes use exact WORLD+DOUBLE masks and only the current certified target pool`,
  stage.panes);
  check(exactP16(stage.reflectionLightCensus),
    `${label} reflection camera owns exact A1/H1/D1/S1/P16 with one shadow`,
    stage.reflectionLightCensus);
  check(stage.finale.active === true && stage.finale.figureVisible === true
      && !['black', 'end'].includes(stage.finale.phase)
      && stage.finale.exactHead != null
      && stage.finale.exactHeadParent === stage.finale.headMount
      && stage.finale.exactHead !== stage.finale.sourceSkull,
  `${label} uses the mounted exact reflection head without resurrecting the source skull`,
  stage.finale);
}

function validateRestoredBootstrapAttribution(label, stage) {
  const phases = stage?.performance?.glByPhase || {};
  const mesh = phases['bootstrap-mesh-basic'];
  const instanced = phases['bootstrap-instanced-basic'];
  const grain = phases['bootstrap-grain'];
  check(mesh?.bufferData === 4 && mesh?.bufferSubData === 0
      && mesh?.createVertexArray === 1
      && instanced?.bufferData === 1 && instanced?.bufferSubData === 0
      && instanced?.createVertexArray === 1
      && grain?.bufferData === 4 && grain?.bufferSubData === 0
      && grain?.createVertexArray === 1,
  `${label} charges all nine restored buffers and three VAOs to the three named bootstrap signatures`,
  { mesh, instanced, grain });
}

const server = await ensureServer();
let browser = null;
let opened = null;
try {
  browser = await launchBrowser();
  opened = await openPage(browser, URL);
  const { page } = opened;
  await page.waitForFunction(() => window.__FETCH?.ready === true,
    null, { timeout: 90000, polling: 20 });
  const capture = await page.evaluate(async ({ caps }) => {
    const g = window.__game;
    const F = window.__FETCH;
    const renderer = g.renderer;
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName = info
      ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const webgl2 = typeof WebGL2RenderingContext !== 'undefined'
      && gl instanceof WebGL2RenderingContext;
    const canvas = renderer.domElement;
    const lose = gl.getExtension('WEBGL_lose_context');
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const stats = () => ({
      programs: renderer.info.programs?.length || 0,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
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
        'bufferSubDataBytes', 'unallocatedBufferSubData', 'bufferAllocationProbeErrors',
        'createVertexArray', 'bindVertexArray',
      ]) {
        target[key] = (target[key] || 0) + (source?.[key] || 0);
      }
      for (const row of source?.samples || []) {
        if (target.samples.length < 24) target.samples.push(row);
      }
    };
    const stageState = new Map();
    let activeStage = null;
    let previousRaf = null;
    let sampling = true;
    let frameSerial = 0;
    let activeFrame = null;
    let activeDraw = null;
    const phaseStack = [];
    const withPhase = (label, callback) => {
      phaseStack.push(label);
      try { return callback(); } finally { phaseStack.pop(); }
    };
    const newStage = (label, expectedAct, options = {}) => {
      const now = performance.now();
      const stage = {
        label, expectedAct, generation: g._webglGeneration,
        startedAt: options.startedAt ?? now,
        restoration: options.restoration || null,
        frames: 0, rafIntervals: 0,
        maxRenderMs: 0, maxRafMs: 0, slowFrames: [], slowRafs: [],
        firstRafObservedAt: null, stageToFirstObservedRafMs: null,
        rafBoundarySamples: [],
        shieldedFrames: 0, visibleResourceFrames: [], samples: [],
        glByPhase: {}, exactCertificateFrameId: null, firstFullFrameId: null,
        ownerCertificateFrameId: null, firstPaneFrameId: null,
        exactCertificateGl: makeGl(), firstFullGl: makeGl(),
        ownerCertificateGl: makeGl(), firstPaneGl: makeGl(),
      };
      stageState.set(label, stage);
      activeStage = stage;
      previousRaf = null;
      return stage;
    };
    const sampleRaf = (timestamp) => {
      const observedAt = performance.now();
      const current = {
        stage: activeStage,
        generation: g._webglGeneration,
        timestamp,
        observedAt,
      };
      if (activeStage && activeStage.firstRafObservedAt == null) {
        activeStage.firstRafObservedAt = observedAt;
        activeStage.stageToFirstObservedRafMs = observedAt - activeStage.startedAt;
      }
      const sameBoundary = activeStage && previousRaf
        && activeStage.generation === g._webglGeneration
        && previousRaf.stage === activeStage
        && previousRaf.generation === g._webglGeneration
        && previousRaf.timestamp >= activeStage.startedAt
        && timestamp >= activeStage.startedAt;
      if (sameBoundary) {
        const durationMs = timestamp - previousRaf.timestamp;
        activeStage.rafIntervals++;
        activeStage.maxRafMs = Math.max(activeStage.maxRafMs, durationMs);
        if (durationMs >= 100) activeStage.slowRafs.push({
          durationMs,
          generation: g._webglGeneration,
          fromTimestamp: previousRaf.timestamp,
          toTimestamp: timestamp,
          fromObservedAt: previousRaf.observedAt,
          toObservedAt: observedAt,
        });
      } else if (activeStage && activeStage.rafBoundarySamples.length < 4) {
        activeStage.rafBoundarySamples.push({
          reason: !previousRaf ? 'no-previous-sample'
            : previousRaf.stage !== activeStage ? 'stage-boundary'
              : previousRaf.generation !== g._webglGeneration ? 'generation-boundary'
                : 'pre-stage-timestamp',
          previousTimestamp: previousRaf?.timestamp ?? null,
          timestamp,
          stageStartedAt: activeStage.startedAt,
          observedAt,
        });
      }
      previousRaf = current;
      if (sampling) requestAnimationFrame(sampleRaf);
    };
    requestAnimationFrame(sampleRaf);

    const traces = [];
    const installGlTrace = () => {
      const context = renderer.getContext();
      const originals = {};
      const wrappers = {};
      const boundBuffers = new Map();
      const allocatedBuffers = new WeakSet();
      const bufferIds = new WeakMap();
      let nextBufferId = 1;
      const bufferId = (buffer) => {
        if (!buffer) return null;
        let id = bufferIds.get(buffer);
        if (id == null) {
          id = nextBufferId++;
          bufferIds.set(buffer, id);
        }
        return id;
      };
      const bucket = () => {
        if (!activeFrame) return null;
        const phase = phaseStack.at(-1) || 'visible-render';
        return activeFrame.phases[phase] ||= makeGl();
      };
      const hook = (name, callback) => {
        originals[name] = context[name];
        const wrapper = function stageCContextGlHook(...args) {
          return callback.call(this, originals[name], args);
        };
        wrappers[name] = wrapper;
        context[name] = wrapper;
        if (context[name] !== wrapper) throw new Error(`could not install GL hook ${name}`);
      };
      const sample = (counts, method, detail = {}) => {
        if (!counts || counts.samples.length >= 24) return;
        counts.samples.push({ method, generation: g._webglGeneration,
          draw: activeDraw ? { ...activeDraw } : null, ...detail });
      };
      hook('bindBuffer', function bindBuffer(original, args) {
        const result = original.apply(this, args);
        boundBuffers.set(args[0], args[1]);
        const counts = bucket();
        if (counts) counts.bindBuffer++;
        return result;
      });
      hook('bufferData', function bufferData(original, args) {
        const counts = bucket();
        const buffer = boundBuffers.get(args[0]);
        const bytes = Number.isFinite(args[1]) ? Number(args[1])
          : Number(args[1]?.byteLength || 0);
        if (counts) {
          counts.bufferData++;
          counts.bufferDataBytes += bytes;
          sample(counts, 'bufferData', { target: args[0], bytes,
            bufferId: bufferId(buffer) });
        }
        if (buffer) allocatedBuffers.add(buffer);
        return original.apply(this, args);
      });
      hook('bufferSubData', function bufferSubData(original, args) {
        const counts = bucket();
        const buffer = boundBuffers.get(args[0]);
        const bytes = Number(args[2]?.byteLength || 0);
        let bufferSizeBefore = null;
        let probeError = null;
        try {
          bufferSizeBefore = Number(context.getBufferParameter(args[0], context.BUFFER_SIZE));
        } catch (error) {
          probeError = error?.message || `${error}`;
        }
        const allocatedBefore = !!buffer
          && (allocatedBuffers.has(buffer) || bufferSizeBefore > 0);
        if (allocatedBefore && buffer) allocatedBuffers.add(buffer);
        if (counts) {
          counts.bufferSubData++;
          counts.bufferSubDataBytes += bytes;
          if (!allocatedBefore) counts.unallocatedBufferSubData++;
          if (probeError) counts.bufferAllocationProbeErrors++;
          sample(counts, 'bufferSubData', { target: args[0], bytes,
            allocatedBefore, bufferSizeBefore, probeError,
            bufferId: bufferId(buffer) });
        }
        return original.apply(this, args);
      });
      hook('createVertexArray', function createVertexArray(original, args) {
        const vao = original.apply(this, args);
        const counts = bucket();
        if (counts) { counts.createVertexArray++; sample(counts, 'createVertexArray'); }
        return vao;
      });
      hook('bindVertexArray', function bindVertexArray(original, args) {
        const counts = bucket();
        if (counts) counts.bindVertexArray++;
        return original.apply(this, args);
      });
      const seedAttribute = (attribute) => {
        if (!attribute) return;
        const properties = renderer.attributes?.get?.(attribute);
        if (properties?.buffer) allocatedBuffers.add(properties.buffer);
      };
      for (const root of [g.scene, g.grainScene]) root?.traverse?.((object) => {
        const geometry = object.geometry;
        if (geometry) {
          seedAttribute(geometry.index);
          for (const attribute of Object.values(geometry.attributes || {})) {
            seedAttribute(attribute);
          }
          for (const list of Object.values(geometry.morphAttributes || {})) {
            for (const attribute of list || []) seedAttribute(attribute);
          }
        }
        seedAttribute(object.instanceMatrix);
        seedAttribute(object.instanceColor);
      });
      const trace = {
        generation: g._webglGeneration,
        installed: Object.entries(wrappers).every(([key, wrapper]) =>
          context[key] === wrapper),
        healthyAtRestore: null,
        healthy: () => Object.entries(wrappers).every(([key, wrapper]) =>
          context[key] === wrapper),
        restore: () => {
          trace.healthyAtRestore = trace.healthy();
          for (const [key, original] of Object.entries(originals)) {
            try { context[key] = original; } catch { /* lost context */ }
          }
        },
      };
      traces.push(trace);
      return trace;
    };
    let trace = installGlTrace();

    const hookedDraws = new Set();
    const drawRestores = [];
    const drawStack = [];
    const installDrawHooks = (roots) => {
      for (const root of roots.filter(Boolean)) root.traverse((object) => {
        if (hookedDraws.has(object.uuid)
            || (!object.isMesh && !object.isLine && !object.isPoints)
            || !object.geometry || !object.material) return;
        hookedDraws.add(object.uuid);
        const before = object.onBeforeRender;
        const after = object.onAfterRender;
        object.onBeforeRender = function stageCContextDraw(rendererArg, scene, camera,
          geometry, material, group) {
          before?.call(this, rendererArg, scene, camera, geometry, material, group);
          drawStack.push(activeDraw);
          activeDraw = {
            object: this.name || this.type || '(unnamed)', objectUuid: this.uuid,
            objectType: this.type, geometryUuid: geometry?.uuid || null,
            material: material?.name || material?.type || '(unnamed)',
            materialUuid: material?.uuid || null,
            targetUuid: rendererArg.getRenderTarget?.()?.texture?.uuid || null,
          };
        };
        object.onAfterRender = function stageCContextDrawRestore(rendererArg, scene, camera,
          geometry, material, group) {
          try { after?.call(this, rendererArg, scene, camera, geometry, material, group); }
          finally { activeDraw = drawStack.pop() ?? null; }
        };
        drawRestores.push(() => {
          object.onBeforeRender = before;
          object.onAfterRender = after;
        });
      });
    };
    installDrawHooks([g.scene, g.grainScene]);

    const realBatch = g._submitReducedWorldBatch;
    g._submitReducedWorldBatch = function tracedContextBatch(progress, options = {}) {
      const label = options.exactOnly
        ? options.ownerOnly ? 'owner-exact-preload'
          : options.deferredOnly ? 'deferred-exact-preload' : 'current-exact-preload'
        : options.ownerOnly ? 'owner-reduced-preload'
          : options.deferredOnly ? 'deferred-reduced-preload' : 'reduced-preload';
      return withPhase(label, () => realBatch.call(this, progress, options));
    };
    const realExact = g._submitExactCurrentPass;
    g._submitExactCurrentPass = function tracedContextExact(options) {
      return withPhase('exact-certificate', () => realExact.call(this, options));
    };
    const realOwner = g._prepareOwnerGpuResidency;
    g._prepareOwnerGpuResidency = function tracedContextOwner(kind) {
      return withPhase(`${kind}-owner-certificate`, () => realOwner.call(this, kind));
    };
    const realBootstrap = g._advanceReducedBootstrap;
    g._advanceReducedBootstrap = function tracedContextBootstrap(...args) {
      const residency = this.currentGpuResidency;
      const stages = ['mesh-basic', 'instanced-basic', 'grain'];
      const label = residency?.surfaceStatus !== 'ready'
        ? 'bootstrap-surface'
        : `bootstrap-${stages[residency?.bootstrapNext] || 'complete'}`;
      return withPhase(label, () => realBootstrap.apply(this, args));
    };
    const realRender = g.render;
    g.render = function measuredContextRender(...args) {
      const before = stats();
      const residency = g.currentGpuResidency;
      const exactBefore = residency?.exactPasses?.length || 0;
      const ownerBefore = residency?.ownerPasses?.length || 0;
      const row = activeFrame = {
        frameId: ++frameSerial, generation: g._webglGeneration,
        stage: activeStage?.label || 'unowned', act: g.act,
        startedAt: performance.now(), phases: {},
      };
      try { return withPhase('visible-render', () => realRender.apply(this, args)); }
      finally {
        const after = stats();
        const live = g.currentGpuResidency;
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
        row.exactPassDelta = (live?.exactPasses?.length || 0) - exactBefore;
        row.ownerPassDelta = (live?.ownerPasses?.length || 0) - ownerBefore;
        row.panesActive = g.finale?.panes?.filter((pane) => pane.active).length || 0;
        if (activeStage) {
          const stage = activeStage;
          stage.frames++;
          stage.maxRenderMs = Math.max(stage.maxRenderMs, row.renderMs);
          if (row.renderMs >= 100) stage.slowFrames.push(clone(row));
          if (row.shielded) stage.shieldedFrames++;
          if (row.worldDrawCalls > 0 && (row.visibleProgramDelta !== 0
              || row.visibleTextureDelta !== 0 || row.visibleGeometryDelta !== 0)) {
            stage.visibleResourceFrames.push(clone(row));
          }
          for (const [phase, counts] of Object.entries(row.phases)) {
            stage.glByPhase[phase] ||= makeGl();
            addGl(stage.glByPhase[phase], counts);
          }
          if (row.exactPassDelta > 0) {
            stage.exactCertificateFrameId = row.frameId;
            stage.exactCertificateGl = clone(row.phases['exact-certificate'] || makeGl());
          }
          if (stage.exactCertificateFrameId != null && stage.firstFullFrameId == null
              && row.frameId > stage.exactCertificateFrameId
              && row.act === stage.expectedAct && row.worldDrawCalls > 0
              && !row.reducedDetail) {
            stage.firstFullFrameId = row.frameId;
            stage.firstFullGl = clone(row.phases['visible-render'] || makeGl());
          }
          if (row.ownerPassDelta > 0) {
            stage.ownerCertificateFrameId = row.frameId;
            stage.ownerCertificateGl = clone(row.phases['finale-owner-certificate'] || makeGl());
          }
          if (stage.ownerCertificateFrameId != null && stage.firstPaneFrameId == null
              && row.frameId > stage.ownerCertificateFrameId && row.panesActive > 0) {
            stage.firstPaneFrameId = row.frameId;
            stage.firstPaneGl = clone(row.phases['visible-render'] || makeGl());
          }
          if (stage.samples.length < 6 || row.exactPassDelta || row.ownerPassDelta
              || row.frameId === stage.firstFullFrameId || row.frameId === stage.firstPaneFrameId
              || row.renderMs >= 100 || row.shielded) stage.samples.push(clone(row));
        }
        activeFrame = null;
      }
    };

    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const waitFor = async (predicate, label, timeout = 120000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) await frame();
      if (!predicate()) throw new Error(`Stage C context timeout: ${label}`);
    };
    const contextEvent = (name, action) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`missing ${name}`)), 20000);
      canvas.addEventListener(name, () => { clearTimeout(timer); resolve(); }, { once: true });
      action();
    });
    const cycleContext = async () => {
      trace?.restore?.();
      trace = null;
      await contextEvent('webglcontextlost', () => lose.loseContext());
      await new Promise((resolve) => setTimeout(resolve, 50));
      const restoreRequestedAt = performance.now();
      let error = null;
      try {
        await contextEvent('webglcontextrestored', () => lose.restoreContext());
      } catch (caught) {
        error = caught;
        throw caught;
      }
      const restoredAt = performance.now();
      trace = installGlTrace();
      previousRaf = null;
      return {
        restoreRequestedAt,
        restoredAt,
        restoreEventDurationMs: restoredAt - restoreRequestedAt,
        error: error?.message || null,
      };
    };
    const lightCensus = (mask) => {
      const out = {
        total: 0, totalShadows: 0, directionalShadows: 0,
        byType: { AmbientLight: 0, HemisphereLight: 0, DirectionalLight: 0,
          SpotLight: 0, PointLight: 0 },
      };
      g.scene.traverseVisible((object) => {
        if (!object.isLight || (object.layers.mask & mask) === 0
            || !(object.type in out.byType)) return;
        out.total++;
        out.byType[object.type]++;
        if (object.castShadow) {
          out.totalShadows++;
          if (object.isDirectionalLight) out.directionalShadows++;
        }
      });
      return out;
    };
    const summarizeBatch = (entry) => ({
      generation: entry.generation, key: entry.key, kind: entry.kind,
      batch: entry.batch, objects: entry.objects, submittedObjects: entry.submittedObjects,
      geometries: entry.geometries, types: entry.types, rig: entry.rig,
      targetOwner: entry.targetOwner, targetUuid: entry.targetUuid,
      geometryBytes: entry.geometryBytes, submittedElements: entry.submittedElements,
      oversize: entry.oversize, isolatedOversize: entry.isolatedOversize,
      durationMs: entry.durationMs, programDelta: entry.programDelta,
      textureDelta: entry.textureDelta, geometryDelta: entry.geometryDelta,
      stateRestored: entry.stateRestored, generationStable: entry.generationStable,
      fingerprintsStable: entry.fingerprintsStable,
      queuePrefixStable: entry.queuePrefixStable, committed: entry.committed,
      error: entry.error, persistentObjectsAdded: entry.persistentObjectsAdded,
      programIdentityCount: entry.identity?.programIdentity?.count ?? null,
      programIdentity: entry.identity?.programIdentity?.count
        ? clone(entry.identity.programIdentity) : null,
      sources: (entry.identity?.sources || []).map((source) => ({
        entryKey: source.entryKey, object: source.object,
        objectUuid: source.objectUuid,
        objectType: source.objectType, rig: source.rig,
      })),
    });
    const summarizeExactPass = (entry) => ({
      generation: entry.generation, key: entry.key, kind: entry.kind,
      rendered: entry.rendered, durationMs: entry.durationMs,
      programDelta: entry.programDelta, textureDelta: entry.textureDelta,
      geometryDelta: entry.geometryDelta, error: entry.error,
      programSubpasses: (entry.identity?.subpasses || []).map((row) => row.label),
      geometrySubpasses: (entry.identity?.geometrySubpasses || []).map((row) => row.label),
      programIdentityCounts: (entry.identity?.subpasses || [])
        .map((row) => row.programIdentity?.count ?? null),
      geometryUploads: (entry.identity?.geometrySubpasses || [])
        .reduce((sum, row) => sum + (row.uploads?.length || 0), 0),
      geometryChanges: (entry.identity?.geometrySubpasses || [])
        .reduce((sum, row) => sum + (row.changed?.length || 0), 0),
      bufferHooksInstalled: (entry.identity?.geometrySubpasses || [])
        .every((row) => row.bufferHooksInstalled === true),
    });
    const expectedFinaleOwner = () => {
      const reduced = new Set();
      const exactOnly = new Set();
      const roots = [
        ...(g.staticWorldRenderRoots || []), ...(g.finale?.warmRoots || []),
        g.finale?.figure, g.finale?.figure?.userData?.exactHead,
        g.skull?.root, g.skull?.tether, g._impactRing,
        g.goreMesh, g.enemies?.stainPool,
      ].filter(Boolean);
      const visited = new Set();
      for (const root of roots) root.traverse((object) => {
        if (visited.has(object.uuid) || !object.geometry || !object.material) return;
        visited.add(object.uuid);
        if (object.isLine || object.isPoints) exactOnly.add(object.uuid);
        else if (object.isMesh) reduced.add(object.uuid);
      });
      return {
        reduced: [...reduced].sort(), exactOnly: [...exactOnly].sort(),
        all: [...new Set([...reduced, ...exactOnly])].sort(),
        intersection: [...reduced].filter((uuid) => exactOnly.has(uuid)).sort(),
      };
    };
    const routeState = () => ({
      waterfallTaken: g.flags.has('waterfallTaken'), skullMode: g.skull.mode,
      skullParent: g.skull.root.parent?.uuid || null,
      tetherVisible: !!g.skull.tether.visible,
    });
    const summarizeShader = () => ({
      status: g.shaderWarmup?.status,
      generation: g.shaderWarmup?.generation ?? null,
      readyVariants: [...(g.shaderWarmup?.readyVariants || [])],
      carriedReadyVariants: [...(g.shaderWarmup?.carriedReadyVariants || [])],
      currentExactKey: g.shaderWarmup?.currentExactKey || null,
      currentExactRevision: g.shaderWarmup?.currentExactRevision ?? null,
      currentExactStatus: g.shaderWarmup?.currentExactStatus || null,
      currentExactUniverse: g.shaderWarmup?.currentExactUniverse ?? null,
      currentExactRoots: g.shaderWarmup?.currentExactRoots ?? null,
      currentExactRepresentatives: g.shaderWarmup?.currentExactRepresentatives ?? null,
      compileJobsInFlight: g.shaderWarmup?.compileJobsInFlight ?? null,
      pendingTextures: g.shaderWarmup?.pendingTextures ?? null,
      completedAt: g.shaderWarmup?.completedAt ?? null,
      durationMs: g.shaderWarmup?.durationMs ?? null,
      errors: [...(g.shaderWarmup?.errors || [])],
      operations: (g.shaderWarmup?.compileJobs || []).map((entry) => ({
        label: entry.label, error: entry.error || null,
        invalidated: !!entry.invalidated,
        maxSynchronousSliceMs: Math.max(
          entry.submitDurationMs || 0,
          entry.maxReadinessPollDurationMs || 0,
          entry.finalizationDurationMs || 0,
          entry.maxSynchronousSliceMs || 0,
        ),
      })).concat((g.shaderWarmup?.compileSlices || []).map((entry) => ({
        label: entry.label, error: entry.error || null,
        invalidated: false, maxSynchronousSliceMs: entry.ms,
      })), (g.shaderWarmup?.setupSlices || []).map((entry) => ({
        label: entry.label, error: entry.error || null,
        invalidated: false, maxSynchronousSliceMs: entry.ms,
      })), (g.shaderWarmup?.textureSlices || []).map((entry) => ({
        label: entry.label, error: entry.error || null,
        invalidated: false, maxSynchronousSliceMs: entry.ms,
      }))),
    });
    const summarizeReducedPass = (entry) => ({
      generation: entry.generation, key: entry.key, kind: entry.kind,
      batch: entry.batch, objects: entry.objects, geometries: entry.geometries,
      types: entry.types, rig: entry.rig, geometryBytes: entry.geometryBytes,
      submittedElements: entry.submittedElements, oversize: entry.oversize,
      isolatedOversize: entry.isolatedOversize, durationMs: entry.durationMs,
      programDelta: entry.programDelta, textureDelta: entry.textureDelta,
      geometryDelta: entry.geometryDelta, committed: entry.committed,
      stateRestored: entry.stateRestored, generationStable: entry.generationStable,
      fingerprintsStable: entry.fingerprintsStable,
      queuePrefixStable: entry.queuePrefixStable, error: entry.error,
      visibleObjects: entry.visibleObjects,
      persistentObjectsAdded: entry.persistentObjectsAdded,
      physicalRevealDeferred: entry.physicalRevealDeferred,
      pendingPhysicalRevealObjects: entry.pendingPhysicalRevealObjects,
    });
    const summarizeStage = (stage, owner = false) => {
      const residency = g.currentGpuResidency;
      const progress = residency.progressive;
      const key = progress.key;
      const ballastStartedAt = performance.now();
      let ballastError = null;
      try { g._syncShaderBallast?.(); }
      catch (error) { ballastError = error; throw error; }
      const productionSummaryOperations = [{
        label: 'sync-shader-ballast',
        durationMs: performance.now() - ballastStartedAt,
        error: ballastError?.message || null,
      }];
      const batches = (residency.exactPreloadPasses || [])
        .filter((entry) => entry.generation === stage.generation && entry.key === key)
        .map(summarizeBatch);
      const currentKeys = [...progress.exactUniverse].sort();
      const currentSourceKeys = [...new Set(batches
        .filter((entry) => entry.committed)
        .flatMap((entry) => entry.sources)
        .filter((source) => currentKeys.includes(source.entryKey))
        .map((source) => source.entryKey))].sort();
      const allCommitted = currentKeys.every((entryKey) =>
        progress.exactProcessed.has(entryKey) && progress.exactCovered.has(entryKey)
          && progress.exactFingerprints.has(entryKey)
          && progress.exactAllocationFingerprints.has(entryKey)
          && currentSourceKeys.includes(entryKey));
      const ownerKey = owner ? g._ownerGpuResidencyKey('finale') : null;
      const target = g.finale?._targetWarmState;
      const pool = g.finale?.mirrors?.pool || [];
      const expectedOwner = owner ? expectedFinaleOwner() : null;
      const recordedOwnerUniverse = owner
        ? [...(residency.ownerUniverses || [])]
          .filter((entry) => entry.key === key && entry.finale > 0).at(-1) || null
        : null;
      const liveReflectionMasks = owner
        ? g.finale.panes.map((pane) => pane.reflectMask) : [];
      const liveReflectionMaskUnion = liveReflectionMasks
        .reduce((mask, value) => mask | value, 0);
      const reflectionVisible = [];
      if (owner) g.scene.traverseVisible((object) => {
        if ((object.isMesh || object.isLine || object.isPoints)
            && object.geometry && object.material
            && (object.layers.mask & liveReflectionMaskUnion) !== 0) {
          reflectionVisible.push(object.uuid);
        }
      });
      const finishedRoots = owner ? [...new Set([
        ...(g.houseRenderRoots || []), ...(g.outsideRenderRoots || []),
        g.atmosphere?.group,
      ].filter((root) => root?.parent === g.scene))] : [];
      const result = {
        label: stage.label, generation: stage.generation, act: g.act, key,
        route: routeState(), performance: clone(stage),
        exactPasses: (residency.exactPasses || [])
          .filter((entry) => entry.generation === stage.generation && entry.key === key)
          .map(summarizeExactPass),
        exactPreloadPasses: batches,
        exactScanPasses: (residency.exactScanPasses || [])
          .filter((entry) => entry.generation === stage.generation && entry.key === key)
          .map((entry) => ({ generation: entry.generation, key: entry.key,
            scope: entry.scope, durationMs: entry.durationMs, queued: entry.queued,
            universe: entry.universe, covered: entry.covered, stable: entry.stable,
            error: entry.error })),
        currentCoverage: {
          exactShaderRevision: progress.exactShaderRevision,
          exactQueue: progress.exactQueue.length,
          exactUniverse: progress.exactUniverse.size,
          exactCovered: progress.exactCovered.size,
          exactUniverseKeys: currentKeys,
          committedSourceKeys: currentSourceKeys,
          allCommitted,
          failedObjects: [...progress.failedObjects],
          blockedCritical: progress.blockedCritical,
          blockedReason: progress.blockedReason,
        },
        surfacePasses: clone((residency.surfacePasses || [])
          .filter((entry) => entry.generation === stage.generation)),
        bootstrapPasses: clone((residency.bootstrapPasses || [])
          .filter((entry) => entry.generation === stage.generation)),
        snapshotPasses: clone((residency.snapshotPasses || [])
          .filter((entry) => entry.generation === stage.generation && entry.key === key)),
        reducedPasses: (residency.reducedPasses || [])
          .filter((entry) => entry.generation === stage.generation && entry.key === key)
          .map(summarizeReducedPass),
        worldLightCensus: lightCensus((1 << 0) | (1 << 1)),
        shader: summarizeShader(),
        residencyErrors: [...(residency.errors || [])],
        traceHealthy: trace?.healthy?.() === true,
        productionSummaryOperations,
      };
      if (owner) Object.assign(result, {
        ownerKey,
        expectedOwner,
        ownerUniverse: recordedOwnerUniverse,
        ownerPasses: (residency.ownerPasses || [])
          .filter((entry) => entry.generation === stage.generation
            && entry.kind === 'finale' && entry.key === ownerKey),
        target: {
          status: target?.status || null, generation: target?.generation ?? null,
          warmed: target?.warmed ?? null, budget: target?.budget ?? null,
          poolLength: pool.length, poolRefMatches: target?.poolRef === pool,
          targetRefsMatch: !!target && target.targetRefs?.length === pool.length
            && target.targetRefs.every((entry, index) => entry === pool[index]),
          poolEpoch: target?.poolEpoch ?? null,
          poolSignature: target?.poolSignature || null,
          livePoolSignature: g.finale?._renderTargetPoolSignature?.() || null,
          poolTextureUuids: pool.map((entry) => entry.texture?.uuid || 'no-texture'),
          failedTargets: [...(target?.failedTargets || [])],
          errors: [...(target?.errors || [])],
          maxSliceMs: target?.maxSliceMs ?? null,
        },
        panes: {
          activeCount: g.finale.panes.filter((pane) => pane.active).length,
          reflectMasks: liveReflectionMasks,
          reflectMaskUnion: liveReflectionMaskUnion,
          virtualCameraMask: g.finale.mirrors?._vcam?.layers?.mask ?? null,
          textureUuids: g.finale.panes.filter((pane) => pane.active)
            .map((pane) => pane.material.uniforms.tDiffuse.value?.uuid || null)
            .filter(Boolean),
        },
        reflectionLightCensus: lightCensus(liveReflectionMaskUnion),
        visibilityIsolation: clone(g.finale.visibilityIsolation),
        finishedDistrictRoots: {
          total: finishedRoots.length,
          hidden: finishedRoots.filter((root) => root.visible === false).length,
          visible: finishedRoots.filter((root) => root.visible !== false)
            .map((root) => ({ name: root.name || root.type, uuid: root.uuid })),
        },
        reflectionVisible: {
          members: [...new Set(reflectionVisible)].sort(),
          unowned: [...new Set(reflectionVisible)]
            .filter((uuid) => !expectedOwner.all.includes(uuid)).sort(),
          uncovered: [...new Set(reflectionVisible)]
            .filter((uuid) => !new Set(recordedOwnerUniverse?.exactCoveredMembers || [])
              .has(uuid)).sort(),
        },
        finale: {
          active: g.finale.active, phase: g.finale.phase,
          figureVisible: g.finale.figure.visible,
          exactHead: g.finale.figure.userData.exactHead?.uuid || null,
          exactHeadParent: g.finale.figure.userData.exactHead?.parent?.uuid || null,
          headMount: g.finale.figure.userData.headMount?.uuid || null,
          sourceSkull: g.skull.root.uuid,
        },
      });
      return clone(result);
    };
    const physicalReady = (stage) => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      return progress && residency.generation === stage.generation
        && residency.physical.has(progress.key)
        && progress.exactQueue.length === 0
        && stage.exactCertificateFrameId != null
        && stage.firstFullFrameId != null
        && !g.lastRender?.reducedDetail;
    };
    const finaleReady = (stage) => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const ownerKey = g._ownerGpuResidencyKey('finale');
      return physicalReady(stage) && g.finale.active && g.act === 'mirror'
        && progress.ownerQueue.length === 0 && progress.ownerExactQueue.length === 0
        && progress.ownerRecorded && progress.ownerExactRecorded
        && residency.owners.has(ownerKey)
        && g.finale._targetWarmState?.status === 'ready'
        && stage.ownerCertificateFrameId != null && stage.firstPaneFrameId != null
        && g.finale.panes.some((pane) => pane.active);
    };

    let caveInitial;
    let caveRestored;
    let finaleInitial;
    let finaleRestored;
    let route;
    const setupOperations = [];
    const timedSetup = (label, callback) => {
      const startedAt = performance.now();
      let error = null;
      let value;
      try { value = callback(); }
      catch (caught) { error = caught; throw caught; }
      finally {
        setupOperations.push({
          label,
          durationMs: performance.now() - startedAt,
          error: error?.message || null,
        });
      }
      return value;
    };
    try {
      const caveRouteTaskStartedAt = performance.now();
      timedSetup('wake-start', () => F.start());
      g._selfStep = false;
      timedSetup('route-teleport-clearing', () => F.teleport('clearing'));
      timedSetup('route-step-clearing', () => F.stepWith(1 / 120, {}, false));
      const waterfall = g.world.fetchTargets.find((target) => target.id === 'waterfall');
      const directive = timedSetup('route-waterfall-sacrifice', () => {
        const result = waterfall?.enabled
          ? waterfall.onHit.call(waterfall, g.skull, waterfall.pos,
            { interactionsLive: true }) : null;
        if (result === 'gone') g.skull.vanish();
        return result;
      });
      route = {
        directive, targetEnabled: !!waterfall?.enabled,
        ...routeState(), caveEnabled: !!g.caveZone?.enabled,
        setupOperations,
      };
      if (directive !== 'gone' || !route.waterfallTaken || route.skullMode !== 'gone'
          || route.skullParent != null || route.tetherVisible || !route.caveEnabled) {
        throw new Error(`waterfall transaction did not establish gone state: ${JSON.stringify(route)}`);
      }

      timedSetup('route-teleport-cave', () => F.teleport('cave'));
      timedSetup('route-step-cave', () => F.stepWith(1 / 120, {}, false));
      setupOperations.push({
        label: 'route-cave-task-envelope',
        durationMs: performance.now() - caveRouteTaskStartedAt,
        error: null,
      });
      const cave0 = newStage('cave-initial', 'cave');
      await waitFor(() => physicalReady(cave0), 'generation-zero cave exact reveal');
      await waitFor(() => g.shaderWarmup?.status === 'ready',
        'generation-zero cave complete shader itinerary');
      await frame();
      caveInitial = summarizeStage(cave0);

      const caveGeneration = g._webglGeneration;
      activeStage = null;
      const caveRestoration = await cycleContext();
      if (!(g._webglGeneration > caveGeneration)) {
        throw new Error('cave context restoration did not advance generation');
      }
      const caveR = newStage('cave-restored', 'cave', {
        startedAt: caveRestoration.restoreRequestedAt,
        restoration: caveRestoration,
      });
      await waitFor(() => physicalReady(caveR), 'restored cave exact reveal');
      await waitFor(() => g.shaderWarmup?.status === 'ready',
        'restored cave complete shader itinerary');
      await frame();
      caveRestored = summarizeStage(caveR);

      const finale0 = newStage('finale-initial', 'mirror');
      timedSetup('route-enter-mirror-room', () => g.director.enterMirrorRoom());
      for (let index = 0; index < 40 && !g.finale.active; index++) {
        timedSetup(`route-finale-step-${index + 1}`, () => F.stepWith(0.05, {}, false));
        await frame();
      }
      await waitFor(() => g.finale.active && g.act === 'mirror', 'production Finale begin');
      installDrawHooks([
        ...(g.finale.warmRoots || []), g.finale.figure,
        g.finale.figure.userData.exactHead,
      ]);
      await waitFor(() => finaleReady(finale0), 'initial Finale exact owner and panes');
      await waitFor(() => g.shaderWarmup?.status === 'ready',
        'initial Finale complete shader itinerary');
      await frame();
      finaleInitial = summarizeStage(finale0, true);

      const finaleGeneration = g._webglGeneration;
      activeStage = null;
      const finaleRestoration = await cycleContext();
      if (!(g._webglGeneration > finaleGeneration)) {
        throw new Error('Finale context restoration did not advance generation');
      }
      const finaleR = newStage('finale-restored', 'mirror', {
        startedAt: finaleRestoration.restoreRequestedAt,
        restoration: finaleRestoration,
      });
      installDrawHooks([
        ...(g.finale.warmRoots || []), g.finale.figure,
        g.finale.figure.userData.exactHead,
      ]);
      await waitFor(() => finaleReady(finaleR), 'restored Finale exact owner and panes');
      await waitFor(() => g.shaderWarmup?.status === 'ready',
        'restored Finale complete shader itinerary');
      await frame();
      finaleRestored = summarizeStage(finaleR, true);
    } finally {
      activeStage = null;
      sampling = false;
      trace?.restore?.();
      g.render = realRender;
      g._submitReducedWorldBatch = realBatch;
      g._submitExactCurrentPass = realExact;
      g._prepareOwnerGpuResidency = realOwner;
      g._advanceReducedBootstrap = realBootstrap;
      for (const restore of drawRestores.reverse()) restore();
      await frame();
    }
    return {
      caps, renderer: rendererName, webgl2, contextSupported: !!lose,
      route, caveInitial, caveRestored, finaleInitial, finaleRestored,
      traceInstallations: traces.map((entry) => ({
        generation: entry.generation,
        healthy: entry.installed && entry.healthyAtRestore !== false,
      })),
    };
  }, { caps: CAPS });

  report.renderer = capture.renderer;
  report.webgl2 = capture.webgl2;
  report.contextSupported = capture.contextSupported;
  report.route = capture.route;
  report.caveInitial = capture.caveInitial;
  report.caveRestored = capture.caveRestored;
  report.finaleInitial = capture.finaleInitial;
  report.finaleRestored = capture.finaleRestored;
  report.traceInstallations = capture.traceInstallations;
  report.browserErrors = [...opened.errors];

  check(report.webgl2 === true, 'Stage C context gate runs on WebGL2', report.webgl2);
  check(/(?:D3D11|Direct3D11)/i.test(report.renderer || ''),
    'system Chrome reports real ANGLE D3D11', report.renderer);
  check(report.contextSupported === true,
    'WEBGL_lose_context supports both context cycles');
  check(report.traceInstallations.length === 3
      && report.traceInstallations.every((entry) => entry.healthy),
  'GL allocation/VAO hooks are healthy in all three generations',
  report.traceInstallations);
  const setupOperations = report.route?.setupOperations || [];
  const requiredSetup = [
    'wake-start', 'route-teleport-clearing', 'route-step-clearing',
    'route-waterfall-sacrifice', 'route-teleport-cave', 'route-step-cave',
    'route-cave-task-envelope', 'route-enter-mirror-room',
  ];
  check(requiredSetup.every((label) => setupOperations.some((entry) => entry.label === label))
      && setupOperations.length >= requiredSetup.length
      && setupOperations.every((entry) => entry.error == null && entry.durationMs < 100),
  'every named production route and Finale setup operation is strictly sub-100ms', {
    requiredSetup,
    operations: setupOperations,
  });
  validatePhysical('generation-zero cave', report.caveInitial, 'cave');
  validatePhysical('restored cave', report.caveRestored, 'cave');
  validateFinale('initial active Finale', report.finaleInitial);
  validateFinale('restored active Finale', report.finaleRestored);
  validateRestoredBootstrapAttribution('restored cave', report.caveRestored);
  validateRestoredBootstrapAttribution('restored active Finale', report.finaleRestored);
  check(report.caveInitial?.generation === 0
      && report.caveRestored?.generation > report.caveInitial?.generation
      && report.finaleInitial?.generation === report.caveRestored?.generation
      && report.finaleRestored?.generation > report.finaleInitial?.generation,
  'two distinct context restorations advance cave then active-Finale generations', {
    caveInitial: report.caveInitial?.generation,
    caveRestored: report.caveRestored?.generation,
    finaleInitial: report.finaleInitial?.generation,
    finaleRestored: report.finaleRestored?.generation,
  });
  check(report.finaleInitial?.ownerKey !== report.finaleRestored?.ownerKey,
    'active-Finale restoration re-earns a generation-owned owner certificate', {
      initial: report.finaleInitial?.ownerKey,
      restored: report.finaleRestored?.ownerKey,
    });
  check(equalSorted(report.finaleInitial?.expectedOwner?.reduced,
    report.finaleRestored?.expectedOwner?.reduced)
      && equalSorted(report.finaleInitial?.expectedOwner?.exactOnly,
        report.finaleRestored?.expectedOwner?.exactOnly)
      && equalSorted(report.finaleInitial?.expectedOwner?.all,
        report.finaleRestored?.expectedOwner?.all),
  'initial and restored Finale generations certify the identical authored owner partition', {
    initial: report.finaleInitial?.expectedOwner
      ? { reduced: report.finaleInitial.expectedOwner.reduced.length,
        exactOnly: report.finaleInitial.expectedOwner.exactOnly.length,
        all: report.finaleInitial.expectedOwner.all.length } : null,
    restored: report.finaleRestored?.expectedOwner
      ? { reduced: report.finaleRestored.expectedOwner.reduced.length,
        exactOnly: report.finaleRestored.expectedOwner.exactOnly.length,
        all: report.finaleRestored.expectedOwner.all.length } : null,
  });
  check(report.browserErrors.length === 0,
    'Stage C context gate emits zero page or console errors', report.browserErrors);
} catch (error) {
  failures.push({
    message: 'Stage C context suite crashed',
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
writeFileSync(resultsPath('transition-stage-c-context-regression.json'),
  JSON.stringify(report, null, 2));

if (failures.length) {
  console.error(`\n${failures.length} Stage C context regression(s) failed.`);
  process.exitCode = 1;
} else console.log('\nSTAGE C CAVE/FINALE CONTEXT REGRESSION PASSED');

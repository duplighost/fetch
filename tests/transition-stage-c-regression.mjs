// Focused Stage C D3D11 exact-residency gate.
//
// This owns only the current house view, its complete reflection-owner
// universe, one real owner certificate/reveal, and the same sequence after a
// WebGL context restoration. Broader district/Finale movement remains in the
// later Stage C gates and transition matrix.
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
  scope: 'stage-c-current-house-owner-exact',
  caps: CAPS,
  postCommitContract:
    'certified generation snapshot owns allocation/mapping/material-program identity; dynamic content versions may bufferSubData only to already allocated buffers, and later actors must reuse certified resources',
  renderer: null,
  webgl2: null,
  contextSupported: null,
  initial: null,
  restored: null,
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
const phase = (frame, name) => frame?.phases?.[name] || {
  bindBuffer: 0,
  bufferData: 0,
  bufferDataBytes: 0,
  bufferSubData: 0,
  bufferSubDataBytes: 0,
  unallocatedBufferSubData: 0,
  createVertexArray: 0,
  bindVertexArray: 0,
  samples: [],
  vaoSamples: [],
};

function validateBatch(label, batch, index) {
  const detail = { index, ...batch };
  check(batch.error == null && batch.durationMs < 100,
    `${label} exact preload ${index + 1} is clean and strictly sub-100ms`, detail);
  check(batch.programDelta === 0 && batch.textureDelta === 0
      && batch.geometryDelta >= 0 && batch.geometryDelta <= batch.geometries,
  `${label} exact preload ${index + 1} owns no cold program/texture and bounds geometry`, detail);
  const programIdentity = batch.identity?.programIdentity;
  const sourceKeys = (batch.identity?.sources || []).map((entry) => entry.entryKey);
  check(programIdentity?.count === 0 && (programIdentity?.programs || []).length === 0
      && sourceKeys.length === batch.objects
      && new Set(sourceKeys).size === sourceKeys.length,
  `${label} exact preload ${index + 1} creates no hidden replacement program and names every source`,
  { programIdentity, sourceKeys, objects: batch.objects });
  check(batch.committed === true && batch.stateRestored === true
      && batch.generationStable === true && batch.fingerprintsStable === true
      && batch.queuePrefixStable === true,
  `${label} exact preload ${index + 1} commits one stable restored transaction`, detail);
  check(batch.objects > 0 && batch.submittedObjects === batch.objects
      && batch.persistentObjectsAdded === 0 && batch.visibleObjects === 0
      && batch.exactDeferredBytes === 0
      && (batch.types?.meshes || 0) + (batch.types?.lines || 0)
        + (batch.types?.points || 0) === batch.objects,
  `${label} exact preload ${index + 1} is transient and completely accounted`, detail);
  check((batch.rig === 'world' && batch.lights === 20)
      || (batch.rig === 'held' && batch.lights === 2),
  `${label} exact preload ${index + 1} uses its exact authored light signature`, detail);

  const withinCaps = batch.geometries <= CAPS.geometries
    && batch.objects <= CAPS.objects
    && batch.geometryBytes <= CAPS.bytes
    && batch.submittedElements <= CAPS.elements;
  if (withinCaps) {
    check(batch.oversize == null && batch.isolatedOversize !== true,
      `${label} exact preload ${index + 1} is an ordinary capped batch`, detail);
  } else {
    check(batch.objects === 1 && batch.submittedObjects === 1
        && batch.geometries === 1 && batch.isolatedOversize === true
        && batch.oversize != null
        && Boolean(batch.oversize.object || batch.oversize.name
          || batch.oversize.objectUuid)
        && Boolean(batch.oversize.reason)
        && batch.identity?.sources?.length === 1,
    `${label} exact oversize ${index + 1} is one named isolated resource`, detail);
  }

  if (batch.kind === 'owner-exact-preload-batch') {
    check(batch.targetOwner === 'house' && Boolean(batch.targetUuid),
      `${label} owner exact preload ${index + 1} binds the live named house target`, detail);
  }
}

function validateStage(label, stage) {
  check(stage != null, `${label} Stage C capture exists`, stage);
  if (!stage) return;

  check(stage.wakeMs == null || stage.wakeMs < 50,
    `${label} Wake returns in under 50ms`, stage.wakeMs);
  check(stage.frames.length > 0
      && stage.frames.every((frame) => frame.renderMs < 100),
  `${label} every captured render stays strictly below 100ms`, {
    maxRenderMs: Math.max(0, ...stage.frames.map((frame) => frame.renderMs)),
    slow: stage.frames.filter((frame) => frame.renderMs >= 100),
  });
  check(stage.rafIntervals.length > 0
      && stage.rafIntervals.every((entry) => entry.observedIntervalMs < 100
        && entry.orderingValid),
    `${label} every ordered post-render callback interval stays strictly below 100ms`, {
      maxObservedRafMs: Math.max(0,
        ...stage.rafIntervals.map((entry) => entry.observedIntervalMs)),
      slowObserved: stage.rafIntervals.filter((entry) => entry.observedIntervalMs >= 100),
      orderingErrors: stage.rafIntervals.filter((entry) => !entry.orderingValid),
      maxRafTimestampMs: Math.max(0,
        ...stage.rafIntervals.map((entry) => entry.timestampIntervalMs)),
      timestampJumps: stage.rafIntervals.filter((entry) => entry.timestampIntervalMs >= 100),
    });
  check(stage.renderIntervals.length > 0
      && stage.renderIntervals.every((entry) => entry.startIntervalMs < 100
        && entry.completionIntervalMs < 100 && entry.interRenderIdleMs < 100),
    `${label} every render-start, completion, and inter-render idle interval stays strictly below 100ms`, {
      maxStartIntervalMs: Math.max(0,
        ...stage.renderIntervals.map((entry) => entry.startIntervalMs)),
      maxCompletionIntervalMs: Math.max(0,
        ...stage.renderIntervals.map((entry) => entry.completionIntervalMs)),
      maxInterRenderIdleMs: Math.max(0,
        ...stage.renderIntervals.map((entry) => entry.interRenderIdleMs)),
      slow: stage.renderIntervals.filter((entry) => entry.startIntervalMs >= 100
        || entry.completionIntervalMs >= 100 || entry.interRenderIdleMs >= 100),
    });
  check(stage.frames.every((frame) => frame.shielded === false),
    `${label} uses zero opaque shader-shield frames`,
    stage.frames.filter((frame) => frame.shielded));
  check(stage.frames.filter((frame) => frame.worldDrawCalls > 0).every((frame) =>
    frame.visibleProgramDelta === 0 && frame.visibleTextureDelta === 0
      && frame.visibleGeometryDelta === 0),
  `${label} every delivered world frame creates zero visible programs/textures/geometries`,
  stage.frames.filter((frame) => frame.worldDrawCalls > 0
      && (frame.visibleProgramDelta !== 0 || frame.visibleTextureDelta !== 0
        || frame.visibleGeometryDelta !== 0)));

  const exactBatches = stage.exactPreloadPasses.filter((entry) =>
    ['current-exact-preload-batch', 'owner-exact-preload-batch'].includes(entry.kind));
  const currentExactBatches = exactBatches.filter((entry) =>
    entry.kind === 'current-exact-preload-batch');
  check(exactBatches.some((entry) => entry.kind === 'current-exact-preload-batch')
      && exactBatches.some((entry) => entry.kind === 'owner-exact-preload-batch'),
  `${label} exercises both current and house-owner exact preload lanes`,
  exactBatches.map((entry) => entry.kind));
  exactBatches.forEach((batch, index) => validateBatch(label, batch, index));

  check(stage.exactScanPasses.length > 0
      && stage.exactScanPasses.every((entry) =>
        entry.error == null && entry.durationMs < 100),
  `${label} every named exact fingerprint scan is clean and strictly sub-100ms`,
  stage.exactScanPasses);
  for (const scope of ['critical', 'owner']) {
    const scans = stage.exactScanPasses.filter((entry) => entry.scope === scope);
    const final = scans.at(-1);
    check(final?.stable === true && final?.queued === 0
        && final?.covered === final?.universe,
    `${label} final ${scope} exact scan closes its complete universe`, final);
  }

  check(stage.currentCoverage.exactQueue === 0
      && stage.currentCoverage.exactCovered === stage.currentCoverage.exactUniverse
      && stage.currentCoverage.failedObjects.length === 0
      && stage.currentCoverage.blockedCritical === false
      && stage.currentCoverage.allCommitted === true,
  `${label} current exact universe is completely committed before reveal`,
  stage.currentCoverage);
  check(stage.currentCoverage.committedSourceKeys.every((key) =>
    stage.currentCoverage.exactUniverseKeys.includes(key)),
  `${label} committed current source identities belong to the certified universe`,
  stage.currentCoverage);
  const currentLinePoints = stage.currentCoverage.linePoints || [];
  check(currentLinePoints.length > 0 && currentLinePoints.every((entry) =>
    stage.currentCoverage.exactUniverseKeys.includes(entry.key)
      && stage.currentCoverage.committedSourceKeys.includes(entry.key)
      && currentExactBatches.some((batch) =>
        (batch.types?.lines || 0) + (batch.types?.points || 0) > 0
          && (batch.identity?.sources || []).some((source) =>
            source.entryKey === entry.key && source.objectUuid === entry.objectUuid))),
  `${label} current-view Line/Points are submitted exactly before physical reveal`, {
    currentLinePoints,
    matchingBatches: currentExactBatches.filter((batch) =>
      (batch.types?.lines || 0) + (batch.types?.points || 0) > 0),
  });
  check(currentExactBatches.some((batch) => batch.rig === 'held'),
    `${label} current exact preload includes the held-skull light signature`,
    currentExactBatches.map((batch) => batch.rig));

  const exactPasses = stage.exactPasses.filter((entry) => entry.kind === 'exact');
  check(exactPasses.length === 1, `${label} exact physical certificate runs exactly once`,
    exactPasses);
  for (const entry of exactPasses) {
    const programSubpasses = entry.identity?.subpasses || [];
    const geometrySubpasses = entry.identity?.geometrySubpasses || [];
    const geometryTrace = entry.identity?.geometryTrace || null;
    const requiredSubpasses = ['grain', 'held', 'world'];
    check(entry.error == null && entry.durationMs < 100
        && entry.programDelta === 0 && entry.textureDelta === 0
        && entry.geometryDelta === 0,
    `${label} exact physical certificate is zero-allocation and strictly sub-100ms`, entry);
    check(programSubpasses.length > 0 && programSubpasses.every((subpass) =>
      subpass.programDelta === 0 && subpass.textureDelta === 0
        && subpass.geometryDelta === 0
        && subpass.programIdentity?.count === 0
        && subpass.programIdentity?.ownerTraversalSkipped === true
        && (subpass.programIdentity?.programs || []).length === 0),
    `${label} every exact program subpass creates nothing`, programSubpasses);
    check(geometryTrace?.objects > 0 && geometryTrace?.attributes > 0
        && geometryTrace?.arrays > 0 && geometryTrace?.bufferHooksInstalled === true
        && (geometryTrace.attributeApiAvailable === false
          ? geometryTrace.stateCheckMode === 'gl-hooks-only'
            && geometryTrace.stateChecksSkipped === geometryTrace.attributes
            && geometryTrace.baselineResident == null
            && geometryTrace.initiallyUnresident == null
          : geometryTrace.stateCheckMode === 'selective-unresident'
            && geometryTrace.stateChecksSkipped === 0
            && geometryTrace.baselineResident >= 0
            && geometryTrace.initiallyUnresident >= 0
            && geometryTrace.baselineResident + geometryTrace.initiallyUnresident
              === geometryTrace.attributes),
    `${label} geometry certificate traces a nonempty candidate universe honestly`,
    geometryTrace);
    check(geometrySubpasses.length > 0 && geometrySubpasses.every((subpass) =>
      subpass.bufferHooksInstalled === true
        && (subpass.changed || []).length === 0
        && subpass.recheckedAttributes === (geometryTrace?.attributeApiAvailable
          ? geometryTrace.initiallyUnresident : 0)
        && (subpass.uploads || []).every((upload) => upload.method !== 'bufferData')),
    `${label} every exact geometry subpass performs zero cold bufferData`,
    geometrySubpasses);
    check(equalSorted(programSubpasses.map((subpass) => subpass.label), requiredSubpasses)
        && equalSorted(geometrySubpasses.map((subpass) => subpass.label), requiredSubpasses),
    `${label} exact certificate covers world, held, and grain once each`, {
      programs: programSubpasses.map((subpass) => subpass.label),
      geometries: geometrySubpasses.map((subpass) => subpass.label),
    });
  }

  const certificateFrame = stage.frames.find((frame) => frame.exactPassRange[1]
    > frame.exactPassRange[0]);
  const exactFrame = stage.frames.find((frame) => frame.worldDrawCalls > 0
    && frame.reducedDetail === false
    && (!certificateFrame || frame.frameId > certificateFrame.frameId));
  const lastCurrentPreload = stage.frames.filter((frame) => frame.exactPreloadKinds
    .includes('current-exact-preload-batch')).at(-1);
  check(certificateFrame != null && exactFrame != null
      && certificateFrame.frameId > (lastCurrentPreload?.frameId ?? -1)
      && exactFrame.frameId > certificateFrame.frameId
      && certificateFrame.reducedDetail === true
      && phase(certificateFrame, 'exact-certificate').bufferData === 0
      && phase(certificateFrame, 'exact-certificate').createVertexArray === 0
      && phase(certificateFrame, 'exact-certificate').unallocatedBufferSubData === 0
      && exactFrame.worldDrawCalls > 0 && exactFrame.reducedDetail === false
      && exactFrame.visibleProgramDelta === 0 && exactFrame.visibleTextureDelta === 0
      && exactFrame.visibleGeometryDelta === 0
      && phase(exactFrame, 'visible-render').bufferData === 0
      && phase(exactFrame, 'visible-render').createVertexArray === 0,
  `${label} hidden certificate and first exact production frame are separate zero-cold paints`,
  { certificateFrame, exactFrame, lastCurrentPreload });

  const owner = stage.ownerUniverse;
  const expected = stage.expectedOwner;
  check(owner != null
      && equalSorted(owner.members, expected.reduced)
      && equalSorted(owner.coveredMembers, expected.reduced)
      && equalSorted(owner.exactOnlyMembers, expected.exactOnly)
      && equalSorted(owner.exactMembers, expected.all)
      && equalSorted(owner.exactCoveredMembers, expected.all)
      && owner.total === expected.reduced.length && owner.covered === owner.total
      && owner.exactTotal === expected.all.length
      && owner.exactCovered === owner.exactTotal
      && expected.exactOnly.length > 0 && expected.intersection.length === 0,
  `${label} owner membership deliberately partitions Mesh from exact-only Line/Points`,
  { owner, expected });
  check(stage.ownerExactSourceUuids.length > 0
      && expected.exactOnly.every((uuid) => stage.ownerExactSourceUuids.includes(uuid))
      && exactBatches.some((entry) =>
        (entry.types?.lines || 0) + (entry.types?.points || 0) > 0),
  `${label} every exact-only owner is actually submitted before owner certification`, {
    expectedExactOnly: expected.exactOnly,
    ownerExactSourceUuids: stage.ownerExactSourceUuids,
  });

  const ownerPasses = stage.ownerPasses.filter((entry) => entry.kind === 'house');
  check(ownerPasses.length === 1, `${label} house owner certificate runs exactly once`,
    ownerPasses);
  const ownerPass = ownerPasses[0];
  check(ownerPass?.rendered === true && ownerPass?.error == null
      && ownerPass?.durationMs < 100 && ownerPass?.programDelta === 0
      && ownerPass?.textureDelta === 0 && ownerPass?.geometryDelta === 0
      && ownerPass?.identity?.programIdentity?.count === 0
      && ownerPass?.identity?.programIdentity?.ownerTraversalSkipped === true,
  `${label} house owner certificate is zero-allocation and strictly sub-100ms`, ownerPass);
  const ownerFrame = stage.frames.find((frame) => frame.ownerPassRange[1]
    > frame.ownerPassRange[0]);
  const lastOwnerPreload = stage.frames.filter((frame) => frame.exactPreloadKinds
    .includes('owner-exact-preload-batch')).at(-1);
  const paneFrame = stage.frames.find((frame) => frame.paneActive
    && (!ownerFrame || frame.frameId > ownerFrame.frameId));
  const ownerExactBatches = exactBatches.filter((entry) =>
    entry.kind === 'owner-exact-preload-batch');
  check(ownerFrame != null && lastOwnerPreload != null && paneFrame != null
      && lastOwnerPreload.frameId < ownerFrame.frameId
      && ownerFrame.frameId < paneFrame.frameId
      && phase(ownerFrame, 'house-owner-certificate').bufferData === 0
      && phase(ownerFrame, 'house-owner-certificate').createVertexArray === 0
      && paneFrame.worldDrawCalls > 0 && paneFrame.reducedDetail === false
      && paneFrame.visibleProgramDelta === 0 && paneFrame.visibleTextureDelta === 0
      && paneFrame.visibleGeometryDelta === 0
      && phase(paneFrame, 'visible-render').bufferData === 0
      && phase(paneFrame, 'visible-render').createVertexArray === 0
      && paneFrame.paneTextureUuid === paneFrame.targetTextureUuid
      && paneFrame.targetTextureUuid === stage.ownerTargetUuid
      && ownerPass.key === ownerFrame.ownerKey
      && ownerExactBatches.every((entry) =>
        entry.targetUuid === stage.ownerTargetUuid)
      && !/(?:missing|no-texture)/.test(paneFrame.ownerKey || ''),
  `${label} owner preload, hidden certificate, and first live pane reveal are strictly ordered`,
  { lastOwnerPreload, ownerFrame, paneFrame });

  const requiredShaderLabels = [
    'core-ordinary', 'held-view', 'grain', 'house-world',
    'current-view-exact', 'house-reflection',
  ];
  const relevantJob = /^(?:core-ordinary|held-view|grain|house-world|current-view-exact|house-reflection):?/;
  const jobs = stage.shader.compileJobs.filter((job) => relevantJob.test(job.label || ''));
  check(jobs.length > 0 && jobs.every((job) => job.error == null
      && job.invalidated !== true && job.submitDurationMs < 100
      && job.maxReadinessPollDurationMs < 100
      && job.finalizationDurationMs < 100 && job.maxSynchronousSliceMs < 100),
  `${label} every relevant shader job has only sub-100ms synchronous slices`, jobs);
  const slices = stage.shader.compileSlices.filter((entry) =>
    /^(?:core-ordinary|held-view|grain|house-world|current-view-exact|house-reflection)/
      .test(entry.label || ''));
  check(slices.length > 0 && slices.every((entry) => entry.error == null && entry.ms < 100),
    `${label} every relevant shader submission slice is strictly sub-100ms`, slices);
  for (const requiredLabel of requiredShaderLabels) {
    check(jobs.some((entry) => entry.label === requiredLabel
        || entry.label?.startsWith(`${requiredLabel}:`))
        && slices.some((entry) => entry.label === requiredLabel
          || entry.label?.startsWith(`${requiredLabel}:`)),
    `${label} shader label ${requiredLabel} has a real compile job and submission slice`, {
      jobs: jobs.filter((entry) => entry.label === requiredLabel
        || entry.label?.startsWith(`${requiredLabel}:`)).length,
      slices: slices.filter((entry) => entry.label === requiredLabel
        || entry.label?.startsWith(`${requiredLabel}:`)).length,
    });
  }
  const targetSlices = stage.shader.setupSlices.filter((entry) =>
    /^house-mirror-target:/.test(entry.label || ''));
  check(stage.shader.setupSlices.length > 0
      && stage.shader.setupSlices.every((entry) => entry.error == null && entry.ms < 100),
  `${label} every shader setup slice is named and strictly sub-100ms`,
  stage.shader.setupSlices);
  check(stage.shader.textureSlices.every((entry) => entry.error == null && entry.ms < 100),
    `${label} every texture upload slice is named and strictly sub-100ms`,
    stage.shader.textureSlices);
  const currentSignatureSlices = stage.shader.setupSlices.filter((entry) =>
    /^signature:current-view:(?:pre|post)$/.test(entry.label || ''));
  check(['signature:current-view:pre', 'signature:current-view:post'].every((name) =>
    currentSignatureSlices.some((entry) => entry.label === name))
      && currentSignatureSlices.every((entry) => entry.error == null && entry.ms < 100),
  `${label} current exact signature is revalidated in bounded pre/post slices`,
  currentSignatureSlices);
  check(targetSlices.length > 0
      && targetSlices.every((entry) => entry.error == null && entry.ms < 100),
  `${label} house render-target setup is named and strictly sub-100ms`, targetSlices);
  check(['house-world', 'held-view', 'grain', 'current-view-exact',
    'house-reflection', 'house-mirror-target'].every((variant) =>
    stage.shader.readyVariants.includes(variant))
      && stage.shader.currentExactKey === stage.currentCoverage.key
      && stage.shader.currentExactRevision === stage.currentCoverage.exactShaderRevision
      && stage.shader.currentExactStatus === 'ready'
      && stage.shader.currentExactUniverse === stage.currentCoverage.exactUniverse
      && stage.shader.currentExactSignatureEntries
        === stage.currentCoverage.worldSignatureUniverse
      && stage.shader.currentExactLiveSignatureEntries
        === stage.currentCoverage.worldSignatureUniverse
      && stage.shader.currentExactRoots > 0
      && stage.shader.currentExactRepresentatives > 0,
  `${label} shader readiness is keyed to this exact physical universe`, stage.shader);
  check(stage.shader.errors.length === 0,
    `${label} shader pipeline emits zero errors`, stage.shader.errors);

  check(stage.glTrace.wrapperHealthy === true
      && stage.glTrace.unallocatedBufferSubData === 0
      && stage.glTrace.outside?.bufferData === 0
      && stage.glTrace.outside?.createVertexArray === 0
      && stage.glTrace.outside?.unallocatedBufferSubData === 0,
  `${label} GL tracing stays installed and no unnamed outside-render allocation escapes`,
  stage.glTrace);
  const future = stage.futureHouseReveal;
  check(future?.poolReused === true && future?.actors === 3
      && future?.setupMs < 100
      && future?.submitted?.pool?.default > 0
      && future?.submitted?.walker?.default > 0
      && future?.submitted?.resident?.default > 0
      && future?.frame?.worldDrawCalls > 0 && future?.frame?.reducedDetail === false
      && future?.frame?.renderMs < 100
      && future?.programDelta === 0 && future?.textureDelta === 0
      && future?.geometryDelta === 0
      && future?.frame?.visibleProgramDelta === 0
      && future?.frame?.visibleTextureDelta === 0
      && future?.frame?.visibleGeometryDelta === 0
      && future?.visiblePhase?.bufferData === 0
      && future?.visiblePhase?.createVertexArray === 0
      && future?.visiblePhase?.unallocatedBufferSubData === 0,
  `${label} pooled figure and newly spawned house actors reveal with zero cold GPU work`, future);
  check(stage.residencyErrors.length === 0,
    `${label} exact residency emits zero runtime errors`, stage.residencyErrors);
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
    const cloneValue = (value) => JSON.parse(JSON.stringify(value));
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const waitFor = async (predicate, label, timeout = 120000, diagnostic = null) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) await frame();
      if (!predicate()) {
        let detail = null;
        try { detail = diagnostic?.() ?? null; }
        catch (error) { detail = { diagnosticError: error?.message || `${error}` }; }
        throw new Error(`Stage C timed out waiting for ${label}`
          + (detail == null ? '' : `: ${JSON.stringify(detail)}`));
      }
    };
    const stats = () => ({
      programs: g.renderer.info.programs?.length || 0,
      textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries,
    });
    const phaseStack = ['async-outside-render'];
    const withPhase = (label, callback) => {
      phaseStack.push(label);
      try { return callback(); }
      finally { phaseStack.pop(); }
    };
    const makeCounts = () => ({
      bindBuffer: 0,
      bufferData: 0,
      bufferDataBytes: 0,
      bufferSubData: 0,
      bufferSubDataBytes: 0,
      unallocatedBufferSubData: 0,
      createVertexArray: 0,
      bindVertexArray: 0,
      samples: [],
      vaoSamples: [],
    });
    let activeFrame = null;
    // Keep the hot draw path allocation-free. A steady reduced/full frame can
    // contain hundreds of draws while producing no cold GL event at all; eagerly
    // cloning identity metadata for each one makes the observer part of the
    // timing result. Raw references are enough until an allocation/VAO sample
    // actually needs a durable identity row.
    let activeDrawObject = null;
    let activeDrawGeometry = null;
    let activeDrawMaterial = null;
    let activeDrawCamera = null;
    let activeDrawRenderer = null;
    let outsideCounts = makeCounts();
    let trace = null;
    const traceInstallations = [];
    const activeDrawIdentity = () => activeDrawGeometry ? {
      object: activeDrawObject?.name || activeDrawObject?.type || '(unnamed)',
      objectType: activeDrawObject?.type || null,
      objectUuid: activeDrawObject?.uuid || null,
      geometryUuid: activeDrawGeometry?.uuid || null,
      material: activeDrawMaterial?.name || activeDrawMaterial?.type || '(unnamed)',
      materialType: activeDrawMaterial?.type || null,
      materialUuid: activeDrawMaterial?.uuid || null,
      side: activeDrawMaterial?.side ?? null,
      transparent: !!activeDrawMaterial?.transparent,
      wireframe: !!activeDrawMaterial?.wireframe,
      layers: activeDrawObject?.layers?.mask ?? null,
      camera: activeDrawCamera?.name || activeDrawCamera?.type || null,
      cameraLayers: activeDrawCamera?.layers?.mask ?? null,
      targetUuid: activeDrawRenderer?.getRenderTarget?.()?.texture?.uuid || null,
    } : null;
    const installTrace = () => {
      const gl = g.renderer.getContext();
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
        const label = phaseStack.at(-1) || 'async-outside-render';
        if (!activeFrame) return outsideCounts;
        return activeFrame.phases[label] ||= makeCounts();
      };
      const sample = (counts, row) => {
        if (counts.samples.length < 32) counts.samples.push(row);
      };
      const hook = (name, implementation) => {
        originals[name] = gl[name];
        const wrapper = function stageCGlHook(...args) {
          return implementation.call(this, originals[name], args);
        };
        wrappers[name] = wrapper;
        gl[name] = wrapper;
        if (gl[name] !== wrapper) throw new Error(`could not install GL hook ${name}`);
      };
      hook('bindBuffer', function bindBuffer(original, args) {
        const result = original.apply(this, args);
        boundBuffers.set(args[0], args[1]);
        const counts = bucket();
        counts.bindBuffer++;
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
        sample(counts, {
          method: 'bufferData', target: args[0], bytes,
          bufferId: idFor(bufferIds, buffer, 'buffer'),
          generation: g._webglGeneration,
        });
        return original.apply(this, args);
      });
      hook('bufferSubData', function bufferSubData(original, args) {
        const counts = bucket();
        const buffer = boundBuffers.get(args[0]);
        const bytes = Number(args[2]?.byteLength || 0);
        const allocatedBefore = !!buffer && allocatedBuffers.has(buffer);
        counts.bufferSubData++;
        counts.bufferSubDataBytes += bytes;
        if (!allocatedBefore) counts.unallocatedBufferSubData++;
        sample(counts, {
          method: 'bufferSubData', target: args[0], bytes, allocatedBefore,
          bufferId: idFor(bufferIds, buffer, 'buffer'),
          generation: g._webglGeneration,
        });
        return original.apply(this, args);
      });
      hook('createVertexArray', function createVertexArray(original, args) {
        const vao = original.apply(this, args);
        const counts = bucket();
        counts.createVertexArray++;
        const row = {
          method: 'createVertexArray',
          vaoId: idFor(vaoIds, vao, 'vao'),
          generation: g._webglGeneration,
          draw: activeDrawIdentity(),
        };
        if (counts.vaoSamples.length < 64) counts.vaoSamples.push(row);
        sample(counts, row);
        return vao;
      });
      hook('bindVertexArray', function bindVertexArray(original, args) {
        const counts = bucket();
        counts.bindVertexArray++;
        return original.apply(this, args);
      });

      const seedAttribute = (attribute) => {
        if (!attribute) return;
        const properties = g.renderer.attributes?.get?.(attribute);
        if (properties?.buffer) allocatedBuffers.add(properties.buffer);
      };
      for (const root of [g.scene, g.grainScene]) {
        root?.traverse?.((object) => {
          const geometry = object.geometry;
          if (!geometry) return;
          seedAttribute(geometry.index);
          for (const attribute of Object.values(geometry.attributes || {})) seedAttribute(attribute);
          for (const list of Object.values(geometry.morphAttributes || {})) {
            for (const attribute of list || []) seedAttribute(attribute);
          }
          seedAttribute(object.instanceMatrix);
          seedAttribute(object.instanceColor);
        });
      }
      const healthy = () => Object.entries(wrappers)
        .every(([name, wrapper]) => gl[name] === wrapper);
      const restore = () => {
        for (const [name, original] of Object.entries(originals)) {
          try { gl[name] = original; } catch { /* context may already be lost */ }
        }
      };
      const installation = { generation: g._webglGeneration, installed: healthy() };
      traceInstallations.push(installation);
      return { gl, originals, wrappers, healthy, restore, allocatedBuffers, installation };
    };

    const realSubmitBatch = g._submitReducedWorldBatch;
    g._submitReducedWorldBatch = function tracedResidencyBatch(progress, options = {}) {
      const label = options.exactOnly
        ? options.ownerOnly ? 'owner-exact-preload'
          : options.deferredOnly ? 'deferred-exact-preload' : 'current-exact-preload'
        : options.ownerOnly ? 'owner-reduced-preload'
          : options.deferredOnly ? 'deferred-reduced-preload' : 'reduced-preload';
      return withPhase(label, () => realSubmitBatch.call(this, progress, options));
    };
    const realExactPass = g._submitExactCurrentPass;
    g._submitExactCurrentPass = function tracedExactPass(options) {
      return withPhase('exact-certificate', () => realExactPass.call(this, options));
    };
    const realOwnerPass = g._prepareOwnerGpuResidency;
    g._prepareOwnerGpuResidency = function tracedOwnerPass(kind) {
      return withPhase(`${kind}-owner-certificate`, () => realOwnerPass.call(this, kind));
    };
    const realRenderBufferDirect = g.renderer.renderBufferDirect;
    g.renderer.renderBufferDirect = function tracedRenderBufferDirect(
      camera, scene, geometry, material, object, group,
    ) {
      const previousObject = activeDrawObject;
      const previousGeometry = activeDrawGeometry;
      const previousMaterial = activeDrawMaterial;
      const previousCamera = activeDrawCamera;
      const previousRenderer = activeDrawRenderer;
      activeDrawObject = object;
      activeDrawGeometry = geometry;
      activeDrawMaterial = material;
      activeDrawCamera = camera;
      activeDrawRenderer = this;
      try {
        return realRenderBufferDirect.call(this,
          camera, scene, geometry, material, object, group);
      } finally {
        activeDrawObject = previousObject;
        activeDrawGeometry = previousGeometry;
        activeDrawMaterial = previousMaterial;
        activeDrawCamera = previousCamera;
        activeDrawRenderer = previousRenderer;
      }
    };
    // Three's internal render path does not consistently route through the
    // public renderBufferDirect property. Source-object callbacks bracket the
    // binding-state setup that creates a VAO, so keep a second independent draw
    // identity channel for every authored scene/grain renderable.
    const drawHookRestores = [];
    const drawStack = [];
    const installDrawIdentityHooks = (root) => root?.traverse?.((object) => {
      if ((!object.isMesh && !object.isLine && !object.isPoints)
          || !object.geometry || !object.material) return;
      const before = object.onBeforeRender;
      const after = object.onAfterRender;
      object.onBeforeRender = function stageCDrawIdentity(
        renderer, scene, camera, geometry, material, group,
      ) {
        before?.call(this, renderer, scene, camera, geometry, material, group);
        drawStack.push(activeDrawObject, activeDrawGeometry, activeDrawMaterial,
          activeDrawCamera, activeDrawRenderer);
        activeDrawObject = this;
        activeDrawGeometry = geometry;
        activeDrawMaterial = material;
        activeDrawCamera = camera;
        activeDrawRenderer = renderer;
      };
      object.onAfterRender = function stageCDrawIdentityRestore(
        renderer, scene, camera, geometry, material, group,
      ) {
        try { after?.call(this, renderer, scene, camera, geometry, material, group); }
        finally {
          activeDrawRenderer = drawStack.pop() ?? null;
          activeDrawCamera = drawStack.pop() ?? null;
          activeDrawMaterial = drawStack.pop() ?? null;
          activeDrawGeometry = drawStack.pop() ?? null;
          activeDrawObject = drawStack.pop() ?? null;
        }
      };
      drawHookRestores.push(() => {
        object.onBeforeRender = before;
        object.onAfterRender = after;
      });
    });
    installDrawIdentityHooks(g.scene);
    installDrawIdentityHooks(g.grainScene);

    const frames = [];
    const intervals = [];
    let frameId = 0;
    let stageLabel = 'prestart';
    let sampling = true;
    let previousRaf = null;
    let lastCompletedRender = null;
    const sampleRaf = (timestamp) => {
      const observedAt = performance.now();
      const current = {
        stage: stageLabel,
        generation: g._webglGeneration,
        timestamp,
        observedAt,
        completedFrameId: lastCompletedRender?.frameId ?? null,
        completedAt: lastCompletedRender?.completedAt ?? null,
        completedStage: lastCompletedRender?.stage ?? null,
        completedGeneration: lastCompletedRender?.generation ?? null,
      };
      if (previousRaf && previousRaf.stage === current.stage
          && previousRaf.generation === current.generation) {
        const timestampIntervalMs = timestamp - previousRaf.timestamp;
        const observedIntervalMs = observedAt - previousRaf.observedAt;
        intervals.push({
          stage: stageLabel,
          generation: g._webglGeneration,
          durationMs: timestampIntervalMs,
          timestampIntervalMs,
          observedIntervalMs,
          previousCallbackLagMs: previousRaf.observedAt - previousRaf.timestamp,
          currentCallbackLagMs: observedAt - timestamp,
          fromCompletedFrameId: previousRaf.completedFrameId,
          toCompletedFrameId: current.completedFrameId,
          fromCompletedAt: previousRaf.completedAt,
          toCompletedAt: current.completedAt,
          orderingValid: Number.isInteger(previousRaf.completedFrameId)
            && Number.isInteger(current.completedFrameId)
            && current.completedFrameId > previousRaf.completedFrameId
            && previousRaf.completedStage === stageLabel
            && current.completedStage === stageLabel
            && previousRaf.completedGeneration === g._webglGeneration
            && current.completedGeneration === g._webglGeneration
            && previousRaf.completedAt <= previousRaf.observedAt
            && current.completedAt <= observedAt,
          at: observedAt,
        });
      }
      previousRaf = current;
      if (sampling) requestAnimationFrame(sampleRaf);
    };
    requestAnimationFrame(sampleRaf);

    const realRender = g.render;
    g.render = function measuredStageCRender(...args) {
      const residency = g.currentGpuResidency;
      const beforeStats = stats();
      const before = {
        exactPreload: residency?.exactPreloadPasses?.length || 0,
        exact: residency?.exactPasses?.length || 0,
        owner: residency?.ownerPasses?.length || 0,
      };
      const row = activeFrame = {
        frameId: ++frameId,
        stage: stageLabel,
        generation: g._webglGeneration,
        startedAt: performance.now(),
        phases: {},
      };
      try {
        return withPhase('visible-render', () => realRender.apply(this, args));
      } finally {
        row.completedAt = performance.now();
        row.renderMs = row.completedAt - row.startedAt;
        lastCompletedRender = {
          frameId: row.frameId,
          stage: row.stage,
          generation: row.generation,
          completedAt: row.completedAt,
        };
        const afterStats = stats();
        const liveResidency = g.currentGpuResidency;
        row.worldDrawCalls = g.lastRender?.worldDrawCalls || 0;
        row.reducedDetail = !!g.lastRender?.reducedDetail;
        row.shielded = !!g._shaderTransitionShield;
        row.visibleProgramDelta = g.lastRender?.visibleProgramDelta || 0;
        row.visibleTextureDelta = g.lastRender?.visibleTextureDelta || 0;
        row.visibleGeometryDelta = g.lastRender?.visibleGeometryDelta || 0;
        row.rawProgramDelta = afterStats.programs - beforeStats.programs;
        row.rawTextureDelta = afterStats.textures - beforeStats.textures;
        row.rawGeometryDelta = afterStats.geometries - beforeStats.geometries;
        row.exactPreloadRange = [before.exactPreload,
          liveResidency?.exactPreloadPasses?.length || 0];
        row.exactPassRange = [before.exact, liveResidency?.exactPasses?.length || 0];
        row.ownerPassRange = [before.owner, liveResidency?.ownerPasses?.length || 0];
        row.exactPreloadKinds = [...(liveResidency?.exactPreloadPasses || [])]
          .slice(...row.exactPreloadRange).map((entry) => entry.kind);
        row.paneActive = !!g.houseMirror?.pane?.active;
        row.paneTextureUuid = g.houseMirror?.pane?.material?.uniforms?.tDiffuse?.value?.uuid || null;
        row.targetTextureUuid = g.houseMirror?.pool?.pool?.[0]?.texture?.uuid || null;
        row.ownerKey = g._ownerGpuResidencyKey?.('house') || null;
        row.wrapperHealthy = trace?.healthy?.() === true;
        frames.push(row);
        activeFrame = null;
      }
    };

    const canvas = g.renderer.domElement;
    const gl = g.renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = rendererInfo
      ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    const webgl2 = typeof WebGL2RenderingContext !== 'undefined'
      && gl instanceof WebGL2RenderingContext;
    const lose = gl.getExtension('WEBGL_lose_context');
    const contextEvent = (name, action) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`missing ${name}`)), 20000);
      canvas.addEventListener(name, () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      action();
    });

    const ownerExpected = () => {
      const reduced = new Set();
      const exactOnly = new Set();
      const roots = [
        ...(g.staticWorldRenderRoots || []),
        ...(g.houseRenderRoots || []),
        ...(g.graveyardRenderRoots || []),
        g.atmosphere?.group,
        g.houseMirror?.double,
        g.houseMirror?.echo,
        g.musicBox?.thingPool,
        ...(g.enemies?.gpuResidencyRoots?.(['walker', 'resident']) || []),
        g.skull?.root,
        g.skull?.tether,
        g._impactRing,
        g.goreMesh,
        g.enemies?.stainPool,
      ].filter(Boolean);
      const visited = new Set();
      for (const root of roots) root.traverse((object) => {
        if (visited.has(object.uuid) || !object.geometry || !object.material) return;
        visited.add(object.uuid);
        if (object.isLine || object.isPoints) exactOnly.add(object.uuid);
        else if (object.isMesh) reduced.add(object.uuid);
      });
      const all = new Set([...reduced, ...exactOnly]);
      return {
        reduced: [...reduced].sort(),
        exactOnly: [...exactOnly].sort(),
        all: [...all].sort(),
        intersection: [...reduced].filter((uuid) => exactOnly.has(uuid)).sort(),
      };
    };

    const generationReady = (generation, expectedStage) => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      if (!progress || residency.generation !== generation) return false;
      const certificateFrame = frames.find((entry) => entry.generation === generation
        && entry.stage === expectedStage
        && entry.exactPassRange?.[1] > entry.exactPassRange?.[0]);
      const hasExactFrame = frames.some((entry) => entry.generation === generation
        && entry.stage === expectedStage
        && entry.frameId > (certificateFrame?.frameId || Infinity)
        && entry.worldDrawCalls > 0 && !entry.reducedDetail);
      const hasOwnerFrame = frames.some((entry) => entry.generation === generation
        && entry.stage === expectedStage
        && entry.ownerPassRange?.[1] > entry.ownerPassRange?.[0]);
      const ownerFrameId = frames.find((entry) => entry.generation === generation
        && entry.stage === expectedStage
        && entry.ownerPassRange?.[1] > entry.ownerPassRange?.[0])?.frameId || Infinity;
      const hasLaterPane = frames.some((entry) => entry.generation === generation
        && entry.stage === expectedStage
        && entry.frameId > ownerFrameId && entry.paneActive);
      return residency.physical.has(progress.key)
        && progress.exactQueue.length === 0
        && progress.ownerQueue.length === 0
        && progress.ownerExactQueue.length === 0
        && progress.ownerRecorded && progress.ownerExactRecorded
        && residency.ownerPasses.some((entry) => entry.generation === generation
          && entry.kind === 'house' && entry.error == null)
        && hasExactFrame && hasOwnerFrame && hasLaterPane;
    };
    const generationDiagnostic = (generation, expectedStage) => {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const warmup = g.shaderWarmup;
      const recentFrames = frames.filter((entry) => entry.generation === generation
        && entry.stage === expectedStage).slice(-8).map((entry) => ({
        frameId: entry.frameId,
        renderMs: entry.renderMs,
        reducedDetail: entry.reducedDetail,
        worldDrawCalls: entry.worldDrawCalls,
        paneActive: entry.paneActive,
        exactPreloadKinds: entry.exactPreloadKinds,
        exactPassRange: entry.exactPassRange,
        ownerPassRange: entry.ownerPassRange,
      }));
      return {
        generation,
        liveGeneration: g._webglGeneration,
        residencyGeneration: residency?.generation,
        activeKey: residency?.activeKey,
        physical: progress ? residency.physical.has(progress.key) : false,
        progress: progress ? {
          key: progress.key,
          complete: progress.complete,
          exactShaderRevision: progress.exactShaderRevision,
          queue: progress.queue.length,
          pendingReducedReveal: progress.pendingReducedReveal.length,
          exactQueue: progress.exactQueue.length,
          ownerQueue: progress.ownerQueue.length,
          ownerExactQueue: progress.ownerExactQueue.length,
          exactUniverse: progress.exactUniverse.size,
          exactCovered: progress.exactCovered.size,
          ownerUniverse: progress.ownerUniverse.size,
          ownerCovered: progress.ownerCovered.size,
          ownerExactUniverse: progress.ownerExactUniverse.size,
          ownerExactCovered: progress.ownerExactCovered.size,
          ownerRecorded: progress.ownerRecorded,
          ownerExactRecorded: progress.ownerExactRecorded,
          blockedCritical: progress.blockedCritical,
          blockedReason: progress.blockedReason,
          failedObjects: [...progress.failedObjects],
          failedOwners: [...progress.failedOwners],
          ownerUncovered: [...progress.ownerUniverse]
            .filter((uuid) => !progress.ownerCovered.has(uuid))
            .slice(0, 32).map((uuid) => {
              const object = g.scene.getObjectByProperty('uuid', uuid);
              return {
                uuid,
                name: object?.name || null,
                type: object?.type || null,
                processed: progress.processed.has(uuid),
                queued: progress.queued.has(uuid),
              };
            }),
        } : null,
        warmup: warmup ? {
          status: warmup.status,
          reason: warmup.reason,
          currentExactKey: warmup.currentExactKey,
          currentExactRevision: warmup.currentExactRevision,
          currentExactStatus: warmup.currentExactStatus,
          readyVariants: warmup.readyVariants,
          compileJobsInFlight: warmup.compileJobsInFlight,
          compileInFlightLabel: warmup.compileInFlightLabel,
          errors: warmup.errors,
        } : null,
        exactPasses: (residency?.exactPasses || []).slice(-4).map((entry) => ({
          generation: entry.generation,
          key: entry.key,
          rendered: entry.rendered,
          durationMs: entry.durationMs,
          programDelta: entry.programDelta,
          textureDelta: entry.textureDelta,
          geometryDelta: entry.geometryDelta,
          error: entry.error,
        })),
        ownerPasses: (residency?.ownerPasses || []).slice(-4).map((entry) => ({
          generation: entry.generation,
          kind: entry.kind,
          key: entry.key,
          rendered: entry.rendered,
          durationMs: entry.durationMs,
          programDelta: entry.programDelta,
          textureDelta: entry.textureDelta,
          geometryDelta: entry.geometryDelta,
          error: entry.error,
        })),
        residencyErrors: residency?.errors?.slice(-12) || [],
        recentFrames,
      };
    };

    const futureHouseReveals = new Map();
    const auditFutureHouseReveal = (generation) => {
      const pool = g.musicBox?.thingPool;
      if (!pool) throw new Error('missing pooled music-box corner figure');
      const setupAt = performance.now();
      const before = stats();
      const beforeFrameId = frameId;
      const savedPlayer = {
        position: g.player.pos.clone(), yaw: g.player.yaw, pitch: g.player.pitch,
      };
      const savedMusicBox = {
        wound: g.musicBox.wound,
        spawned: g.musicBox.spawned,
        thing: g.musicBox.thing,
      };
      const savedPool = {
        position: pool.position.clone(), scale: pool.scale.clone(),
        parent: pool.parent,
      };
      const spawnLogLength = g.spawnLog?.length || 0;
      const spawnSerial = g.enemies._spawnSerial;
      pool.removeFromParent();
      g.musicBox.thing = null;
      g.musicBox.wound = 0;
      g.musicBox.spawned = false;
      g.player.pos.set(-10.2, 4.6, 4.8);
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      g.director._updateMusicBox(0);
      const authoredThing = g.musicBox.thing;
      const poolReused = authoredThing === pool && authoredThing?.uuid === pool.uuid
        && authoredThing?.parent === g.scene;
      g.player.pos.copy(savedPlayer.position);
      g.player.yaw = savedPlayer.yaw;
      g.player.pitch = savedPlayer.pitch;
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      const cameraPosition = g.camera.getWorldPosition(g.player.pos.clone());
      const forward = g.camera.getWorldDirection(g.player.pos.clone()).normalize();
      const right = g.player.pos.clone().set(-forward.z, 0, forward.x).normalize();
      pool.position.copy(cameraPosition).addScaledVector(forward, 4.2);
      pool.position.y -= 0.8;
      pool.scale.setScalar(1);
      g.scene.add(pool);
      g.musicBox.thing = pool;
      const walker = g.enemies.spawn('walker', g.player.pos.x, g.player.pos.z, 'dormant');
      const resident = g.enemies.spawn('resident', g.player.pos.x, g.player.pos.z, 'dormant');
      walker.mesh.position.copy(cameraPosition).addScaledVector(forward, 5.2)
        .addScaledVector(right, -1.15);
      resident.mesh.position.copy(cameraPosition).addScaledVector(forward, 5.8)
        .addScaledVector(right, 1.15);
      const submitted = Object.fromEntries(['pool', 'walker', 'resident'].map((family) => [
        family, { total: 0, default: 0, targets: {} },
      ]));
      const restores = [];
      const countRoot = (root, family) => root?.traverse((object) => {
        if ((!object.isMesh && !object.isLine && !object.isPoints)
            || !object.geometry || !object.material) return;
        const previous = object.onBeforeRender;
        object.onBeforeRender = function countFutureReveal(...args) {
          const target = args[0]?.getRenderTarget?.()?.texture?.uuid || 'default';
          const count = submitted[family];
          count.total++;
          if (target === 'default') count.default++;
          count.targets[target] = (count.targets[target] || 0) + 1;
          return previous?.apply(this, args);
        };
        restores.push(() => { object.onBeforeRender = previous; });
      });
      countRoot(pool, 'pool');
      countRoot(walker.mesh, 'walker');
      countRoot(resident.mesh, 'resident');
      const setupMs = performance.now() - setupAt;
      let audit;
      try {
        g.render();
        const after = stats();
        const row = frames.find((entry) => entry.frameId > beforeFrameId
          && entry.generation === generation);
        audit = cloneValue({
          generation,
          actors: Object.keys(submitted).length,
          poolReused,
          setupMs,
          submitted,
          programDelta: after.programs - before.programs,
          textureDelta: after.textures - before.textures,
          geometryDelta: after.geometries - before.geometries,
          frame: row,
          visiblePhase: row?.phases?.['visible-render'] || makeCounts(),
        });
      } finally {
        for (const restore of restores.reverse()) restore();
        pool.removeFromParent();
        pool.position.copy(savedPool.position);
        pool.scale.copy(savedPool.scale);
        if (savedPool.parent) savedPool.parent.add(pool);
        g.musicBox.wound = savedMusicBox.wound;
        g.musicBox.spawned = savedMusicBox.spawned;
        g.musicBox.thing = savedMusicBox.thing;
        g.enemies.clear((enemy) => enemy === walker || enemy === resident);
        g.enemies._spawnSerial = spawnSerial;
        if (g.spawnLog) g.spawnLog.length = spawnLogLength;
      }
      futureHouseReveals.set(generation, audit);
      return audit;
    };

    const summarize = (label, generation, startedAt, endedAt, wakeMs = null) => {
      const residency = g.currentGpuResidency;
      const progress = residency.progressive;
      const stageFrames = frames.filter((entry) => entry.stage === label
        && entry.generation === generation && entry.completedAt >= startedAt
        && entry.startedAt <= endedAt);
      const stageIntervals = intervals.filter((entry) => entry.stage === label
        && entry.generation === generation && entry.at >= startedAt && entry.at <= endedAt);
      const renderIntervals = stageFrames.slice(1).map((entry, index) => ({
        fromFrameId: stageFrames[index].frameId,
        toFrameId: entry.frameId,
        startIntervalMs: entry.startedAt - stageFrames[index].startedAt,
        completionIntervalMs: entry.completedAt - stageFrames[index].completedAt,
        interRenderIdleMs: entry.startedAt - stageFrames[index].completedAt,
      }));
      const ownerUniverse = [...(residency.ownerUniverses || [])]
        .find((entry) => entry.house > 0) || null;
      const currentKeys = [...progress.exactUniverse].sort();
      const sourceRows = (residency.exactPreloadPasses || [])
        .filter((entry) => entry.committed)
        .flatMap((entry) => entry.identity?.sources || []);
      const currentSourceKeys = [...new Set(sourceRows
        .filter((row) => currentKeys.includes(row.entryKey))
        .map((row) => row.entryKey))].sort();
      const ownerSourceRows = sourceRows.filter((row) =>
        progress.ownerExactUniverse.has(row.entryKey));
      const allCommitted = currentKeys.every((key) =>
        progress.exactProcessed.has(key) && progress.exactCovered.has(key)
          && progress.exactFingerprints.has(key)
          && progress.exactAllocationFingerprints.has(key)
          && currentSourceKeys.includes(key));
      const unallocatedBufferSubData = stageFrames.reduce((total, row) =>
        total + Object.values(row.phases).reduce((subtotal, counts) =>
          subtotal + counts.unallocatedBufferSubData, 0), 0);
      return cloneValue({
        generation,
        wakeMs,
        frames: stageFrames,
        rafIntervals: stageIntervals,
        renderIntervals,
        exactPreloadPasses: residency.exactPreloadPasses,
        reducedPasses: residency.reducedPasses,
        exactScanPasses: residency.exactScanPasses,
        exactPasses: residency.exactPasses,
        ownerPasses: residency.ownerPasses,
        ownerUniverse,
        ownerTargetUuid: g.houseMirror?.pool?.pool?.[0]?.texture?.uuid || null,
        deferredUniverses: residency.deferredUniverses,
        expectedOwner: ownerExpected(),
        ownerExactSourceUuids: [...new Set(ownerSourceRows.map((row) => row.objectUuid))].sort(),
        currentCoverage: {
          key: progress.key,
          exactShaderRevision: progress.exactShaderRevision,
          exactQueue: progress.exactQueue.length,
          exactUniverse: progress.exactUniverse.size,
          exactCovered: progress.exactCovered.size,
          worldSignatureUniverse: [...progress.exactUniverse]
            .map((key) => progress.exactObjects.get(key))
            .filter((entry) => entry?.critical && entry.rig === 'world').length,
          exactUniverseKeys: currentKeys,
          committedSourceKeys: currentSourceKeys,
          allCommitted,
          failedObjects: [...progress.failedObjects],
          blockedCritical: progress.blockedCritical,
          blockedReason: progress.blockedReason,
          linePoints: [...progress.exactUniverse]
            .map((key) => progress.exactObjects.get(key))
            .filter((entry) => entry?.object?.isLine || entry?.object?.isPoints)
            .map((entry) => ({ key: entry.key, objectUuid: entry.object.uuid,
              type: entry.object.type, name: entry.object.name || null })),
        },
        shader: {
          status: g.shaderWarmup?.status,
          readyVariants: [...(g.shaderWarmup?.readyVariants || [])],
          currentExactKey: g.shaderWarmup?.currentExactKey || null,
          currentExactRevision: g.shaderWarmup?.currentExactRevision ?? null,
          currentExactUniverse: g.shaderWarmup?.currentExactUniverse ?? null,
          currentExactRoots: g.shaderWarmup?.currentExactRoots ?? null,
          currentExactRepresentatives: g.shaderWarmup?.currentExactRepresentatives ?? null,
          currentExactSignatureEntries: g.shaderWarmup?.currentExactSignatureEntries ?? null,
          currentExactLiveSignatureEntries:
            g.shaderWarmup?.currentExactLiveSignatureEntries ?? null,
          currentExactStatus: g.shaderWarmup?.currentExactStatus || null,
          compileJobs: g.shaderWarmup?.compileJobs || [],
          compileSlices: g.shaderWarmup?.compileSlices || [],
          setupSlices: g.shaderWarmup?.setupSlices || [],
          textureSlices: g.shaderWarmup?.textureSlices || [],
          errors: g.shaderWarmup?.errors || [],
        },
        glTrace: {
          wrapperHealthy: stageFrames.every((entry) => entry.wrapperHealthy)
            && trace?.healthy?.() === true,
          unallocatedBufferSubData,
          outside: outsideCounts,
          installations: traceInstallations,
        },
        futureHouseReveal: futureHouseReveals.get(generation) || null,
        residencyErrors: residency.errors,
      });
    };

    const positionForMirror = () => {
      g.houseMirror.awakened = true;
      g.player.pos.set(g.houseMirror.pos.x + 2.1, 0, g.houseMirror.pos.z);
      g.player.yaw = Math.PI / 2;
      g.player.pitch = 0;
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
    };

    let initial = null;
    let restored = null;
    try {
      trace = installTrace();
      await frame();
      outsideCounts = makeCounts();
      previousRaf = null;
      stageLabel = 'initial';
      const initialGeneration = g._webglGeneration;
      const initialAt = performance.now();
      const wakeAt = performance.now();
      F.start();
      const wakeMs = performance.now() - wakeAt;
      g._selfStep = false;
      F.teleport('house');
      if (g.skull.mode !== 'held') g.skull.holdNow();
      positionForMirror();
      await waitFor(() => generationReady(initialGeneration, 'initial'),
        'initial exact house, owner certificate, and pane reveal', 120000,
        () => generationDiagnostic(initialGeneration, 'initial'));
      auditFutureHouseReveal(initialGeneration);
      await frame();
      const initialEndedAt = performance.now();
      initial = summarize('initial', initialGeneration, initialAt, initialEndedAt, wakeMs);

      if (lose) {
        trace.restore();
        trace = null;
        stageLabel = 'context-lost';
        await contextEvent('webglcontextlost', () => lose.loseContext());
        await new Promise((resolve) => setTimeout(resolve, 50));
        await contextEvent('webglcontextrestored', () => lose.restoreContext());
        await waitFor(() => g._webglGeneration > initialGeneration,
          'restored WebGL generation');
        outsideCounts = makeCounts();
        trace = installTrace();
        previousRaf = null;
        stageLabel = 'restored';
        const restoredGeneration = g._webglGeneration;
        const restoredAt = performance.now();
        g._selfStep = false;
        F.teleport('house');
        if (g.skull.mode !== 'held') g.skull.holdNow();
        positionForMirror();
        await waitFor(() => generationReady(restoredGeneration, 'restored'),
          'restored exact house, owner certificate, and pane reveal', 120000,
          () => generationDiagnostic(restoredGeneration, 'restored'));
        auditFutureHouseReveal(restoredGeneration);
        await frame();
        const restoredEndedAt = performance.now();
        restored = summarize('restored', restoredGeneration,
          restoredAt, restoredEndedAt, null);
      }
    } finally {
      sampling = false;
      trace?.restore?.();
      g.render = realRender;
      g._submitReducedWorldBatch = realSubmitBatch;
      g._submitExactCurrentPass = realExactPass;
      g._prepareOwnerGpuResidency = realOwnerPass;
      g.renderer.renderBufferDirect = realRenderBufferDirect;
      for (const restore of drawHookRestores.reverse()) restore();
      activeDrawObject = null;
      activeDrawGeometry = null;
      activeDrawMaterial = null;
      activeDrawCamera = null;
      activeDrawRenderer = null;
      drawStack.length = 0;
      await frame();
    }

    return {
      caps,
      renderer,
      webgl2,
      contextSupported: !!lose,
      initial,
      restored,
    };
  }, { caps: CAPS });

  report.renderer = capture.renderer;
  report.webgl2 = capture.webgl2;
  report.contextSupported = capture.contextSupported;
  report.initial = capture.initial;
  report.restored = capture.restored;
  report.browserErrors = [...opened.errors];

  check(report.webgl2 === true, 'Stage C runs on a real WebGL2 context', report.webgl2);
  check(/(?:D3D11|Direct3D11)/i.test(report.renderer || ''),
    'system Chrome reports the real ANGLE D3D11 renderer', report.renderer);
  check(report.contextSupported === true,
    'WEBGL_lose_context is available for exact restoration coverage');
  validateStage('initial', report.initial);
  validateStage('restored', report.restored);
  check(report.initial?.generation === 0
      && report.restored?.generation > report.initial?.generation,
    'context restoration advances to a new WebGL generation', {
      initial: report.initial?.generation,
      restored: report.restored?.generation,
    });
  check(equalSorted(report.initial?.ownerUniverse?.members,
    report.restored?.ownerUniverse?.members)
      && equalSorted(report.initial?.ownerUniverse?.exactOnlyMembers,
        report.restored?.ownerUniverse?.exactOnlyMembers)
      && equalSorted(report.initial?.ownerUniverse?.exactMembers,
        report.restored?.ownerUniverse?.exactMembers),
  'initial and restored generations certify the identical house owner partition', {
    initial: report.initial?.ownerUniverse,
    restored: report.restored?.ownerUniverse,
  });
  const initialLinePoints = (report.initial?.currentCoverage?.linePoints || [])
    .map((entry) => `${entry.key}|${entry.objectUuid}`);
  const restoredLinePoints = (report.restored?.currentCoverage?.linePoints || [])
    .map((entry) => `${entry.key}|${entry.objectUuid}`);
  check(equalSorted(report.initial?.currentCoverage?.exactUniverseKeys,
    report.restored?.currentCoverage?.exactUniverseKeys)
      && equalSorted(report.initial?.currentCoverage?.committedSourceKeys,
        report.restored?.currentCoverage?.committedSourceKeys)
      && equalSorted(initialLinePoints, restoredLinePoints),
  'initial and restored generations certify the identical current exact universe', {
    initialKeys: report.initial?.currentCoverage?.exactUniverseKeys,
    restoredKeys: report.restored?.currentCoverage?.exactUniverseKeys,
    initialLinePoints,
    restoredLinePoints,
  });
  check(report.browserErrors.length === 0,
    'Stage C browser run emits zero page or console errors', report.browserErrors);
} catch (error) {
  failures.push({
    message: 'Stage C suite crashed',
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
writeFileSync(resultsPath('transition-stage-c-regression.json'), JSON.stringify(report, null, 2));

if (failures.length) {
  console.error(`\n${failures.length} Stage C transition regression(s) failed.`);
  process.exitCode = 1;
} else console.log('\nSTAGE C EXACT RESIDENCY REGRESSION PASSED');

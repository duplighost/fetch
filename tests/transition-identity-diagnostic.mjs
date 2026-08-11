// Focused D3D11 identity trace. This is deliberately diagnostic rather than a
// duplicate of the full transition matrix: it names the exact first-use
// programs, source objects, BufferGeometries and light identities before any
// residency architecture is tuned around a misleading aggregate delta.
import { writeFileSync } from 'node:fs';
import {
  ensureServer, launchBrowser, openPage, URL_BASE, resultsPath,
} from './lib/harness.mjs';

const url = `${URL_BASE}/?test=1&mute=1&warmup=1&warmupRace=1&gpuidentity=1`;
const failures = [];
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};
const round = (value) => Number.isFinite(value) ? +value.toFixed(3) : null;

const server = await ensureServer();
const browser = await launchBrowser();
let artifact = null;
let opened = null;
try {
  opened = await openPage(browser, url, { width: 1280, height: 720 });
  const { page } = opened;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game?.renderer,
    null, { timeout: 90000, polling: 50 },
  );
  artifact = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    const waitFor = async (predicate, label, timeout = 90000) => {
      const deadline = performance.now() + timeout;
      while (!predicate() && performance.now() < deadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      if (!predicate()) throw new Error(`identity diagnostic timed out: ${label}`);
    };
    const stats = () => ({
      programs: g.renderer.info.programs?.length || 0,
      textures: g.renderer.info.memory.textures,
      geometries: g.renderer.info.memory.geometries,
    });
    const frames = [];
    const intervals = [];
    let previous = null;
    let sampling = true;
    const sampleRaf = (timestamp) => {
      if (previous != null) intervals.push(timestamp - previous);
      previous = timestamp;
      if (sampling) requestAnimationFrame(sampleRaf);
    };
    requestAnimationFrame(sampleRaf);
    const realRender = g.render;
    g.render = function identityMeasuredRender(...args) {
      const before = stats();
      const at = performance.now();
      try { return realRender.apply(this, args); }
      finally {
        const after = stats();
        frames.push({
          at: performance.now(),
          ms: performance.now() - at,
          act: g.act,
          reduced: !!g.lastRender?.reducedDetail,
          calls: g.lastRender?.worldDrawCalls || 0,
          programDelta: after.programs - before.programs,
          textureDelta: after.textures - before.textures,
          geometryDelta: after.geometries - before.geometries,
        });
      }
    };

    const startAt = performance.now();
    F.start();
    const startMs = performance.now() - startAt;
    g._selfStep = false;
    F.teleport('house');
    if (g.skull.mode !== 'held') g.skull.holdNow();
    await waitFor(() => g.shaderWarmup?.status === 'ready', 'shader ready');
    await waitFor(() => g.currentGpuResidency?.physical?.has(g._currentGpuResidencyKey())
      && !g.lastRender?.reducedDetail, 'first exact house world');
    await waitFor(() => {
      const progress = g.currentGpuResidency?.progressive;
      return progress?.ownerRecorded && progress.ownerQueue.length === 0;
    }, 'house owner universe drained');

    // The shipping physical pass enables WORLD + MAIN_ONLY (mask 3). The
    // gameplay camera ordinarily also enables HELD (mask 4), but those two
    // viewmodel lights are submitted in the separate held pass and must not be
    // mistaken for two extra world PointLights in this identity diagnostic.
    const withPhysicalCameraMask = (callback) => {
      const previousMask = g.camera.layers.mask;
      g.camera.layers.mask = 3;
      try { return callback(); }
      finally { g.camera.layers.mask = previousMask; }
    };
    const physicalLightCensus = () => withPhysicalCameraMask(
      () => g._gpuIdentityLightCensus(g.camera),
    );
    const lightCensusBeforeVerbs = physicalLightCensus();
    const action = async (label, perform, count = 5) => {
      const beforePrograms = g._gpuIdentityProgramSnapshot();
      const before = stats();
      const exactBefore = g.currentGpuResidency?.exactPasses?.length || 0;
      const frameIndex = frames.length;
      const intervalIndex = intervals.length;
      perform();
      for (let index = 0; index < count; index++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const after = stats();
      const actionFrames = frames.slice(frameIndex);
      return {
        label,
        before,
        after,
        exactBefore,
        exactAfter: g.currentGpuResidency?.exactPasses?.length || 0,
        maxRenderMs: Math.max(0, ...actionFrames.map((frame) => frame.ms)),
        maxRafMs: Math.max(0, ...intervals.slice(intervalIndex)),
        maxVisibleProgramDelta: Math.max(0, ...actionFrames.map((frame) => frame.programDelta)),
        maxVisibleTextureDelta: Math.max(0, ...actionFrames.map((frame) => frame.textureDelta)),
        maxVisibleGeometryDelta: Math.max(0, ...actionFrames.map((frame) => frame.geometryDelta)),
        frames: actionFrames,
        programIdentity: withPhysicalCameraMask(() => g._gpuIdentityProgramSummary(
          beforePrograms,
          { roots: [g.scene, g.grainScene], camera: g.camera },
        )),
        lights: physicalLightCensus(),
      };
    };

    const firstThrow = await action('fresh-legal-first-throw', () => {
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      F.stepWith(0.12, { throwHeld: true }, false);
    });
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    for (let index = 0; index < 360 && g.skull.mode !== 'held'; index++) {
      F.stepWith(1 / 120, {}, false);
    }
    if (g.skull.mode !== 'held') throw new Error('fresh legal skull did not return');
    const flameAbsorb = await action('fresh-legal-flame-absorb', () => {
      const source = g.flameCircuit?.sources?.[0];
      if (!source || !g.flameCircuit.absorb(g.skull, source)) {
        throw new Error('fresh legal flame source could not be absorbed');
      }
      for (let index = 0; index < 90; index++) F.stepWith(1 / 120, {}, false);
    }, 7);

    const residency = g.currentGpuResidency;
    const identityEvidence = {
      reducedPasses: [...(residency?.reducedPasses || [])],
      exactPasses: [...(residency?.exactPasses || [])],
      skullWorldPasses: [...(residency?.skullWorldPasses || [])],
      ownerPasses: [...(residency?.ownerPasses || [])],
      errors: [...(residency?.errors || [])],
    };

    // Same-generation pool replacement must change the identity even though
    // WebGLRenderTarget itself has no uuid. Both consumers fail closed and the
    // pool-change callback queues a new target/program generation.
    const generation = g._webglGeneration;
    const housePool = g.houseMirror.pool;
    const finalePool = g.finale.mirrors;
    const houseBefore = {
      key: g._ownerGpuResidencyKey('house'),
      poolRef: housePool.pool,
      epoch: housePool.poolEpoch,
      textureIds: housePool.pool.map((target) => target.texture?.uuid || null),
      targetState: g._houseMirrorTargetWarmState,
    };
    residency.owners.add(houseBefore.key);
    g.houseMirror.pane.setActive(true);
    housePool.setSize(housePool.size + 1);
    const houseAfter = {
      key: g._ownerGpuResidencyKey('house'),
      poolChanged: housePool.pool !== houseBefore.poolRef,
      epoch: housePool.poolEpoch,
      textureIds: housePool.pool.map((target) => target.texture?.uuid || null),
      oldOwnerRetired: !residency.owners.has(houseBefore.key),
      oldTargetStateRetired: g._houseMirrorTargetWarmState !== houseBefore.targetState,
      paneActive: g.houseMirror.pane.active,
    };
    const finaleBefore = {
      key: g._ownerGpuResidencyKey('finale'),
      poolRef: finalePool.pool,
      epoch: finalePool.poolEpoch,
      textureIds: finalePool.pool.map((target) => target.texture?.uuid || null),
      targetState: g.finale._targetWarmState,
    };
    residency.owners.add(finaleBefore.key);
    for (const pane of g.finale.panes) pane.setActive(true);
    finalePool.setSize(finalePool.size + 1);
    const finaleAfter = {
      key: g._ownerGpuResidencyKey('finale'),
      poolChanged: finalePool.pool !== finaleBefore.poolRef,
      epoch: finalePool.poolEpoch,
      textureIds: finalePool.pool.map((target) => target.texture?.uuid || null),
      oldOwnerRetired: !residency.owners.has(finaleBefore.key),
      oldTargetStateRetired: g.finale._targetWarmState !== finaleBefore.targetState,
      panesActive: g.finale.panes.map((pane) => pane.active),
    };

    sampling = false;
    g.render = realRender;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      startMs,
      generation,
      lightCensusBeforeVerbs,
      firstThrow,
      flameAbsorb,
      identityEvidence,
      targetIdentity: {
        house: {
          before: { key: houseBefore.key, epoch: houseBefore.epoch,
            textureIds: houseBefore.textureIds },
          after: houseAfter,
        },
        finale: {
          before: { key: finaleBefore.key, epoch: finaleBefore.epoch,
            textureIds: finaleBefore.textureIds },
          after: finaleAfter,
        },
      },
      firstFrames: frames.slice(0, 20),
      maxRafMs: Math.max(0, ...intervals),
      renderer: (() => {
        const gl = g.renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
      })(),
    };
  });

  const types = artifact.lightCensusBeforeVerbs?.byType || {};
  check(artifact.startMs < 50, 'Wake click remains synchronous and responsive', artifact.startMs);
  check(artifact.lightCensusBeforeVerbs?.total === 20
      && types.AmbientLight === 1 && types.HemisphereLight === 1
      && types.DirectionalLight === 1 && types.SpotLight === 1
      && types.PointLight === 16
      && artifact.lightCensusBeforeVerbs.directionalShadows === 1,
    'fresh legal verb trace uses the authored P16 world rather than resurrected P18',
    artifact.lightCensusBeforeVerbs);
  check(artifact.identityEvidence.reducedPasses.some((entry) => entry.identity)
      && artifact.identityEvidence.exactPasses.some((entry) => entry.identity),
    'opt-in source/object/program identity evidence is present');
  for (const [kind, target] of Object.entries(artifact.targetIdentity)) {
    const beforeIds = target.before.textureIds;
    const afterIds = target.after.textureIds;
    const glassFailedClosed = kind === 'house'
      ? target.after.paneActive === false
      : target.after.panesActive.every((active) => active === false);
    check(target.before.key !== target.after.key
        && target.after.epoch === target.before.epoch + 1
        && target.after.poolChanged
        && target.after.oldOwnerRetired
        && target.after.oldTargetStateRetired
        && !target.before.key.includes('missing')
        && !target.after.key.includes('missing')
        && !target.before.key.includes('no-texture')
        && !target.after.key.includes('no-texture')
        && new Set(beforeIds).size === beforeIds.length
        && new Set(afterIds).size === afterIds.length
        && beforeIds.every(Boolean) && afterIds.every(Boolean)
        && beforeIds.every((id) => !afterIds.includes(id))
        && glassFailedClosed,
      `${kind} target replacement changes epoch, ordered texture identity, and retires stale readiness`,
      target);
  }
  check(opened.errors.length === 0, 'identity diagnostic has zero browser errors', opened.errors);
  artifact.browserErrors = opened.errors;
  await page.close();
} catch (error) {
  const message = error?.stack || error?.message || `${error}`;
  failures.push({ message: 'identity diagnostic crashed', detail: message });
  artifact = {
    runError: message,
    browserErrors: [...(opened?.errors || [])],
  };
} finally {
  await browser.close();
  server.stop();
}

const cleanRound = (value) => {
  if (Array.isArray(value)) {
    for (const item of value) cleanRound(item);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'durationMs' || key === 'maxRenderMs' || key === 'maxRafMs'
          || key === 'ms' || key === 'startMs') value[key] = round(item);
      else cleanRound(item);
    }
  }
};
cleanRound(artifact);
writeFileSync(resultsPath('transition-identity-diagnostic.json'), JSON.stringify({
  url,
  failures,
  ...artifact,
}, null, 2));

if (failures.length) {
  console.error(`\n${failures.length} transition identity diagnostic failure(s).`);
  process.exitCode = 1;
} else console.log('\nTRANSITION IDENTITY DIAGNOSTIC CAPTURED');

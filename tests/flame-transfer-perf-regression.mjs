// First-flame-steal resource and lifecycle regression:
//   node tests/flame-transfer-perf-regression.mjs
//
// The guest candle and basement pilot are two physical entrances to one
// circuit. Both must activate the same boot-built embers/sparks without adding
// an Object3D, render resource, or ticker in the interaction frame.
import {
  ensureServer, launchBrowser, openPage, URL_BASE, resultsPath, ROOT,
} from './lib/harness.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const report = {
  url: `${URL_BASE}/?test=1&mute=1`, checks: [], errors: [], diagnostics: {},
};
const failures = [];
const check = (passed, name, details = null) => {
  const row = { name, passed: !!passed, details };
  report.checks.push(row);
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name}`
    + (details == null ? '' : ` -- ${JSON.stringify(details)}`));
  if (!row.passed) failures.push(name);
};

const sourceText = readFileSync(join(ROOT, 'src', 'house.js'), 'utf8');
const mainText = readFileSync(join(ROOT, 'src', 'main.js'), 'utf8');
const circuitStart = sourceText.indexOf('const flameCircuit = {');
const absorbStart = sourceText.indexOf('    absorb(skull, source) {', circuitStart);
const updateStart = sourceText.indexOf('    update(dt, time) {', absorbStart);
const absorbText = sourceText.slice(absorbStart, updateStart);
check(circuitStart >= 0 && absorbStart > circuitStart && updateStart > absorbStart,
  'the focused audit can isolate the live flame-circuit absorption method');
check(!/new\s+THREE\.(?:Mesh|Group|Vector[234]|\w*Geometry|\w*Material)\b/.test(absorbText),
  'absorb constructs no Object3D, geometry, material, group, or vector');
check(!/tickers\.push|computeBoundingBox|\.clone\s*\(/.test(absorbText),
  'absorb installs no ticker and performs no late geometry-centre or clone work');
check(/socketCenter/.test(sourceText.slice(updateStart, sourceText.indexOf('game.flameCircuit = flameCircuit;', updateStart)))
    && /flameCircuit\.transferSparks\.push/.test(sourceText),
  'socket centres, carried embers, and transfer sparks are constructed before registration');
const voidDoorStart = sourceText.indexOf('function voidDoorAct(game) {');
const voidDoorEnd = sourceText.indexOf('export function makeKey', voidDoorStart);
const voidDoorText = sourceText.slice(voidDoorStart, voidDoorEnd);
check(!/const \{[^}]*\bskull\b[^}]*\} = game/.test(voidDoorText)
    && /flameCircuit\.initializeCarry = \(skullInstance\) =>/.test(voidDoorText)
    && /game\.initializeFlameCarry =/.test(voidDoorText),
  'house construction defers socket attachment behind the explicit post-Skull hook');
check(/this\.skull\.setLayers\([\s\S]{0,180}this\.initializeFlameCarry\(this\.skull\);/.test(mainText)
    && !/initializeFlameCarry\?\./.test(mainText),
  'Game invokes the required carry hook immediately after assigning held layers');
const restoreStart = mainText.indexOf("addEventListener('webglcontextrestored'");
const restoreEnd = mainText.indexOf('this.renderer = r;', restoreStart);
const restoreText = mainText.slice(restoreStart, restoreEnd);
check(/flameCircuit\?\.primeDormantResources\?\.\(\)/.test(restoreText)
    && /_impactRing\.userData\.bootPrime = true/.test(restoreText)
    && /flameCircuit\?\.retireDormantResources\?\.\(\)/.test(mainText)
    && /_impactRing\.userData\.bootPrime && !skipGpuSubmission/.test(mainText),
  'the renderer primes flame and impact FX until a delivered full world plus held frame');
const pilotStart = sourceText.indexOf('function buildBasementPilot(game, B) {');
const pilotEnd = sourceText.indexOf('// ---------------------------------------------------------------- act 2', pilotStart);
const pilotText = sourceText.slice(pilotStart, pilotEnd);
check(/if \(game\.act !== 'basement' \|\| game\.dead \|\| game\.terminal\) return;/.test(pilotText),
  'the basement-pilot cosmetic ticker sleeps off-act and during dead or terminal states');
const physicalCompanion = readFileSync(join(ROOT, 'tests', 'basement-causality-regression.mjs'), 'utf8');
check(/throwPressed:\s*true[\s\S]*while\s*\(!g\.flags\.has\('ateFlame'\)/.test(physicalCompanion)
    && /pilotAndCarry\.during\.source === 'basement-pilot'/.test(physicalCompanion),
  'basement causality remains the companion swept-throw proof for this direct allocation audit');

const server = await ensureServer();
let browser;
try {
  browser = await launchBrowser();
} catch (error) {
  server.stop();
  throw error;
}

async function runPath(sourceId, { restoreFirst = false } = {}) {
  const opened = await openPage(browser, report.url, { width: 1280, height: 800 });
  const { page } = opened;
  report.errors.push(...opened.errors);
  try {
    await page.waitForFunction(
      () => window.__FETCH?.ready === true && window.__game,
      null, { timeout: 60000, polling: 100 },
    );
    return await page.evaluate(async ({ requestedSource, restoreBeforeHit }) => {
      const F = window.__FETCH;
      const g = window.__game;
      const fc = g.flameCircuit;
      const wakeStartedAt = performance.now();
      F.start();
      const wakeHandlerMs = performance.now() - wakeStartedAt;
      F.teleport(requestedSource === 'basement-pilot' ? 'basement' : 'house');
      g.enemies.clear();

      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      // The title has normally delivered many frames already. Make the focused
      // contract deterministic: one explicit full world + held render uploads
      // and retires the zero-scale dormant assets through main's handshake.
      g.render();
      F.stepWith(1 / 120, {}, false);
      const fullFrameReady = () => !fc.prewarmPending
        && !g.lastRender.reducedDetail
        && g.lastRender.worldDrawCalls > 0
        && g.lastRender.heldDrawCalls > 0;
      const nonzeroWorld = () => g.lastRender.worldDrawCalls > 0;
      let firstNonzeroMs = nonzeroWorld() ? performance.now() - wakeStartedAt : null;
      let wakeFrames = 0;
      while (!fullFrameReady() && wakeFrames < 120) {
        await nextFrame();
        wakeFrames++;
        if (firstNonzeroMs == null && nonzeroWorld()) {
          firstNonzeroMs = performance.now() - wakeStartedAt;
        }
      }
      const wake = {
        ms: firstNonzeroMs,
        fullMs: performance.now() - wakeStartedAt,
        handlerMs: wakeHandlerMs,
        frames: wakeFrames,
        full: fullFrameReady(),
        render: { ...g.lastRender },
      };
      let context = { requested: restoreBeforeHit, supported: null };
      if (restoreBeforeHit) {
        const gl = g.renderer.getContext();
        const lose = gl.getExtension('WEBGL_lose_context');
        if (!lose) context = { requested: true, supported: false };
        else {
          const canvas = g.renderer.domElement;
          const contextEvent = (name, action) => new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`missing ${name}`)), 20000);
            canvas.addEventListener(name, () => { clearTimeout(timer); resolve(); }, { once: true });
            action();
          });
          const generationBefore = g._webglGeneration;
          await contextEvent('webglcontextlost', () => lose.loseContext());
          await new Promise((resolve) => setTimeout(resolve, 50));
          await contextEvent('webglcontextrestored', () => lose.restoreContext());
          // The house listener exposes one zero-scale representative for each
          // shared resource until the first restored full world + held render,
          // whose explicit handshake retires them before the contact baseline.
          let restoredFrames = 0;
          while (fc.prewarmPending && restoredFrames < 120) {
            await nextFrame();
            F.stepWith(1 / 120, {}, false);
            restoredFrames++;
          }
          context = {
            requested: true,
            supported: true,
            generationBefore,
            generationAfter: g._webglGeneration,
            primes: fc.contextRestorePrimes,
            prewarmPending: fc.prewarmPending,
            restoredFrames,
            impactRing: {
              visible: g._impactRing.visible,
              bootPrime: !!g._impactRing.userData.bootPrime,
              scale: g._impactRing.scale.toArray(),
            },
            renderer: {
              geometries: g.renderer.info.memory.geometries,
              textures: g.renderer.info.memory.textures,
              programs: g.renderer.info.programs?.length || 0,
            },
          };
        }
      }
      if (requestedSource === 'guest-candle') g.voidDoorBeat.open('perf-regression');
      g.render();

      const sceneCardinality = () => {
        let objects = 0;
        let meshes = 0;
        const geometries = new Set();
        const materials = new Set();
        g.scene.traverse((object) => {
          objects++;
          if (!object.isMesh) return;
          meshes++;
          if (object.geometry) geometries.add(object.geometry.uuid);
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list) if (material) materials.add(material.uuid);
        });
        return {
          topLevel: g.scene.children.length,
          descendants: objects,
          meshes,
          geometries: geometries.size,
          materials: materials.size,
        };
      };
      const assetIds = () => ({
        embers: fc.embers.map((ember) => ({
          group: ember.group.uuid,
          outer: ember.outer.uuid,
          lick: ember.lick.uuid,
          core: ember.core.uuid,
          geometry: [ember.outer.geometry.uuid, ember.lick.geometry.uuid, ember.core.geometry.uuid],
          material: [ember.outer.material.uuid, ember.lick.material.uuid, ember.core.material.uuid],
          socket: ember.socket.uuid,
          socketCenter: ember.socketCenter.toArray(),
        })),
        sparks: fc.transferSparks.map((spark) => ({
          object: spark.uuid, geometry: spark.geometry.uuid, material: spark.material.uuid,
        })),
      });
      const resources = () => ({
        rendererGeometries: g.renderer.info.memory.geometries,
        rendererTextures: g.renderer.info.memory.textures,
        rendererPrograms: g.renderer.info.programs?.length || 0,
        tickers: g.tickers.length,
        scene: sceneCardinality(),
      });

      const requested = fc.sources.find((source) => source.id === requestedSource);
      const other = fc.sources.find((source) => source.id !== requestedSource);
      const before = {
        assets: assetIds(), resources: resources(),
        initialized: fc.initialized && fc.skull === g.skull,
        wake,
        bootTiming: g.bootTiming ? { ...g.bootTiming } : null,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        sourceIds: fc.sources.map((source) => source.id),
        dormant: {
          prewarmPending: fc.prewarmPending,
          embers: fc.embers.map((ember) => ({
            visible: ember.group.visible, scale: ember.group.scale.toArray(),
          })),
          sparks: fc.transferSparks.map((spark) => ({
            visible: spark.visible, scale: spark.scale.toArray(),
          })),
        },
      };

      const rafGaps = [];
      let rafLast = performance.now();
      let rafSamples = 0;
      const sampled = new Promise((resolve) => {
        const sample = (now) => {
          rafGaps.push(now - rafLast);
          rafLast = now;
          if (++rafSamples >= 8) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      g.skull.mode = 'outbound';
      const syncStart = performance.now();
      const hitResult = requested.target.onHit(g.skull, requested.point);
      const syncMs = performance.now() - syncStart;
      // The focused callback return would normally be consumed by Skull's
      // swept-hit loop. Keep the viewmodel seated while this test advances time.
      g.skull.mode = 'held';
      const immediate = {
        assets: assetIds(), resources: resources(), source: fc.source,
        flags: {
          ateFlame: g.flags.has('ateFlame'),
          carriedFlameVisible: g.flags.has('carriedFlameVisible'),
          basementPilotUsed: g.flags.has('basementPilotUsed'),
        },
        sources: fc.sources.map((source) => ({
          id: source.id, target: source.target.enabled, flame: source.flame.visible,
          partsVisible: source.parts.filter((part) => part.visible).length,
          glow: source.glow.intensity,
          glowRegistered: g.world.candles.includes(source.glow),
        })),
        embers: fc.embers.map((ember, index) => ({
          visible: ember.group.visible,
          parent: ember.group.parent?.uuid,
          scale: ember.group.scale.toArray(),
          offset: ember.group.position.clone().sub(ember.socketCenter).toArray(),
          expectedX: index === 0 ? -0.004 : 0.004,
        })),
        sparksVisible: fc.transferSparks.filter((spark) => spark.visible).length,
        hitResult, syncMs,
      };
      await sampled;
      const afterRaf = {
        resources: resources(),
        rafGaps,
        maxRafGap: Math.max(...rafGaps),
      };

      // A dead life cannot silently finish the transfer. The already-earned
      // flame remains owned, and the same objects resume after retry.
      F.stepWith(0.15, {}, false);
      const beforeDeath = { transferT: fc.transferT, assets: assetIds() };
      g.director.death(null);
      F.stepWith(1.3, {}, false);
      const whileDead = {
        transferT: fc.transferT, active: fc.transferActive,
        source: fc.source, flags: g.flags.has('ateFlame'), assets: assetIds(),
      };
      g.director.respawn();
      F.stepWith(0.8, {}, false);
      const settled = {
        active: fc.transferActive, complete: fc.transferComplete,
        frames: fc.transferFrames, iterations: fc.sparkIterations,
        sparksVisible: fc.transferSparks.filter((spark) => spark.visible).length,
        emberScales: fc.embers.map((ember) => ember.group.scale.toArray()),
        embersVisible: fc.embers.map((ember) => ember.group.visible),
        assets: assetIds(), resources: resources(), source: fc.source,
      };
      const iterationsAtArrival = fc.sparkIterations;
      const scaleAtArrival = fc.embers.map((ember) => ember.group.scale.toArray());
      F.stepWith(1.1, {}, false);
      const afterSoak = {
        iterations: fc.sparkIterations,
        frames: fc.transferFrames,
        sparksVisible: fc.transferSparks.filter((spark) => spark.visible).length,
        scaleChanged: fc.embers.map((ember, index) =>
          ember.group.scale.toArray().some((value, axis) =>
            Math.abs(value - scaleAtArrival[index][axis]) > 0.00001)),
      };

      // Repeated and alternate physical-source callbacks after ownership is
      // established must both be strict, bounded no-ops for the stable pool.
      const boundedNoop = async (source) => {
        const beforeNoop = { assets: assetIds(), resources: resources(), source: fc.source };
        const gaps = [];
        let last = performance.now();
        let frames = 0;
        const frameSample = new Promise((resolve) => {
          const sample = (now) => {
            gaps.push(now - last);
            last = now;
            if (++frames >= 4) resolve();
            else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        g.skull.mode = 'outbound';
        const started = performance.now();
        const result = source.target.onHit(g.skull, source.point);
        const syncMs = performance.now() - started;
        g.skull.mode = 'held';
        await frameSample;
        return {
          before: beforeNoop,
          after: { assets: assetIds(), resources: resources(), source: fc.source },
          result, syncMs, maxRafGap: Math.max(...gaps), gaps,
          active: fc.transferActive, complete: fc.transferComplete,
        };
      };
      const repeated = await boundedNoop(requested);
      const alternate = await boundedNoop(other);
      return {
        requestedSource, restoreBeforeHit, context, before, immediate, afterRaf,
        beforeDeath, whileDead, settled, afterSoak,
        iterationsAtArrival, repeated, alternate,
      };
    }, { requestedSource: sourceId, restoreBeforeHit: restoreFirst });
  } finally {
    report.errors.push(...opened.errors);
    await page.close();
  }
}

try {
  const guest = await runPath('guest-candle');
  const pilot = await runPath('basement-pilot');
  const guestRestored = await runPath('guest-candle', { restoreFirst: true });
  const pilotRestored = await runPath('basement-pilot', { restoreFirst: true });
  report.diagnostics.guest = guest;
  report.diagnostics.pilot = pilot;
  report.diagnostics.guestRestored = guestRestored;
  report.diagnostics.pilotRestored = pilotRestored;

  for (const run of [guest, pilot, guestRestored, pilotRestored]) {
    const label = `${run.requestedSource}${run.restoreBeforeHit ? ' after WebGL restore' : ''}`;
    check(run.before.sourceIds.length === 2
        && run.before.sourceIds.includes('guest-candle')
        && run.before.sourceIds.includes('basement-pilot')
        && run.before.initialized
        && run.before.assets.embers.length === 2
        && run.before.assets.sparks.length === 7
        && !run.before.dormant.prewarmPending
        && run.before.dormant.embers.every((ember) => !ember.visible)
        && run.before.dormant.sparks.every((spark) => !spark.visible),
    `${label}: cold boot reaches ready with one initialized 2-ember/7-spark circuit`,
    { initialized: run.before.initialized, sourceIds: run.before.sourceIds,
      dormant: run.before.dormant });

    const emberGeometryIds = new Set(run.before.assets.embers.flatMap((ember) => ember.geometry));
    const emberMaterialIds = new Set(run.before.assets.embers.flatMap((ember) => ember.material));
    const sparkGeometryIds = new Set(run.before.assets.sparks.map((spark) => spark.geometry));
    const sparkMaterialIds = new Set(run.before.assets.sparks.map((spark) => spark.material));
    check(emberGeometryIds.size === 3 && emberMaterialIds.size === 2
        && sparkGeometryIds.size === 1 && sparkMaterialIds.size === 1,
    `${label}: all thirteen meshes share four effect geometries and three materials`,
    { emberGeometries: emberGeometryIds.size, emberMaterials: emberMaterialIds.size,
      sparkGeometries: sparkGeometryIds.size, sparkMaterials: sparkMaterialIds.size });

    const firstRenderMs = run.before.bootTiming
      ? run.before.bootTiming.firstRenderEndedAt - run.before.bootTiming.firstRenderStartedAt
      : NaN;
    const constructorMs = run.before.bootTiming
      ? run.before.bootTiming.constructedAt - run.before.bootTiming.constructorStartedAt
      : NaN;
    const moduleReadyMs = run.before.bootTiming
      ? run.before.bootTiming.constructedAt - run.before.bootTiming.moduleStartedAt
      : NaN;
    check(Number.isFinite(constructorMs) && constructorMs >= 0 && constructorMs < 1000
        && Number.isFinite(moduleReadyMs) && moduleReadyMs >= 0 && moduleReadyMs < 1200
        && Number.isFinite(run.before.firstContentfulPaint)
        && run.before.firstContentfulPaint >= 0 && run.before.firstContentfulPaint < 1000,
      `${label}: constructor, button-ready module, and first contentful paint meet the title startup gates`,
      { constructorMs, moduleReadyMs, firstContentfulPaint: run.before.firstContentfulPaint,
        bootTiming: run.before.bootTiming });
    check(Number.isFinite(firstRenderMs) && firstRenderMs >= 0 && firstRenderMs < 100,
      `${label}: the DOM title's deliberately GPU-empty first render stays inside its hard gate`,
      { firstRenderMs, firstContentfulPaint: run.before.firstContentfulPaint,
        bootTiming: run.before.bootTiming });
    check(run.before.wake.handlerMs < 50
        && Number.isFinite(run.before.wake.ms) && run.before.wake.ms < 100,
      `${label}: Wake handler stays under 50 ms and reaches a nonzero world frame under 100 ms`,
      run.before.wake);

    if (run.restoreBeforeHit) {
      check(run.context.supported === true
          && run.context.generationAfter >= run.context.generationBefore + 2
          && run.context.primes >= 1 && !run.context.prewarmPending
          && !run.context.impactRing.visible && !run.context.impactRing.bootPrime,
      `${label}: restoration physically re-primes flame buffers and pilot impact FX before the live hit`,
      run.context);
    }

    check(JSON.stringify(run.before.assets) === JSON.stringify(run.immediate.assets)
        && JSON.stringify(run.before.resources) === JSON.stringify(run.immediate.resources)
        && JSON.stringify(run.before.resources) === JSON.stringify(run.afterRaf.resources),
    `${label}: the contact frame and first rendered frames preserve every object and render-resource cardinality`,
    { before: run.before.resources, immediate: run.immediate.resources, afterRaf: run.afterRaf.resources });

    check(run.immediate.source === run.requestedSource
        && run.immediate.flags.ateFlame && run.immediate.flags.carriedFlameVisible
        && run.immediate.flags.basementPilotUsed === (run.requestedSource === 'basement-pilot')
        && run.immediate.sources.every((source) => !source.target && !source.flame
          && source.partsVisible === 0 && source.glow === 0 && !source.glowRegistered)
        && run.immediate.embers.length === 2
        && run.immediate.embers.every((ember) => ember.visible
          && ember.parent
          && ember.scale.every((value) => value > 0)
          && Math.abs(ember.offset[0] - ember.expectedX) < 0.00001
          && Math.abs(ember.offset[1] + 0.011) < 0.00001
          && Math.abs(ember.offset[2] - 0.03) < 0.00001)
        && run.immediate.sparksVisible === 7,
    `${label}: one successful source owns the transfer while both duplicate fixtures extinguish`,
    run.immediate);

    check(run.immediate.syncMs < 50 && run.afterRaf.maxRafGap < 100,
      `${label}: the first steal stays within the focused synchronous and rAF hitch bounds`,
      { syncMs: run.immediate.syncMs, maxRafGap: run.afterRaf.maxRafGap, gaps: run.afterRaf.rafGaps });

    check(Math.abs(run.whileDead.transferT - run.beforeDeath.transferT) < 0.00001
        && run.whileDead.active && run.whileDead.flags
        && run.whileDead.source === run.requestedSource
        && JSON.stringify(run.beforeDeath.assets) === JSON.stringify(run.whileDead.assets)
        && run.settled.complete && !run.settled.active
        && run.settled.frames <= 76 && run.settled.iterations <= 76 * 7
        && run.settled.sparksVisible === 0
        && run.settled.embersVisible.every(Boolean),
    `${label}: death pauses the earned transfer and retry completes it once with the same pool`,
    { beforeDeath: run.beforeDeath.transferT, whileDead: run.whileDead,
      settled: { active: run.settled.active, complete: run.settled.complete,
        frames: run.settled.frames, iterations: run.settled.iterations,
        sparksVisible: run.settled.sparksVisible, embersVisible: run.settled.embersVisible } });

    check(run.afterSoak.iterations === run.iterationsAtArrival
        && run.afterSoak.frames === run.settled.frames
        && run.afterSoak.sparksVisible === 0
        && run.afterSoak.scaleChanged.every(Boolean),
    `${label}: arrived sparks retire permanently while both carried embers keep flickering`,
    run.afterSoak);

    for (const [kind, noop] of [['repeated', run.repeated], ['alternate', run.alternate]]) {
      check(noop.after.source === run.requestedSource && noop.result === 'return'
          && noop.complete && !noop.active
          && noop.syncMs < 50 && noop.maxRafGap < 100
          && JSON.stringify(noop.before.assets) === JSON.stringify(noop.after.assets)
          && JSON.stringify(noop.before.resources) === JSON.stringify(noop.after.resources),
      `${label}: the ${kind} source hit is an idempotent bounded zero-growth no-op`,
      noop);
    }
  }

  check(report.errors.length === 0, 'no browser console or page errors', report.errors);
} catch (error) {
  report.errors.push(error?.stack || String(error));
  check(false, 'flame transfer regression completed', error?.message || String(error));
} finally {
  writeFileSync(resultsPath('flame-transfer-perf-regression.json'), JSON.stringify(report, null, 2));
  try {
    await browser.close();
  } finally {
    server.stop();
  }
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s): ${failures.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log(`\n${report.checks.length} flame-transfer performance checks passed.`);
}

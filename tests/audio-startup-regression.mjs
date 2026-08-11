// Focused live-WebAudio Wake gate.
//
// Runs in system Chrome with real ANGLE/D3D11. Chrome's process output remains
// muted by the shared harness, but FETCH itself is deliberately NOT ?mute=1:
// the production AudioContext, procedural buffers, source graph, scheduling,
// idempotence and terminal cancellation all execute normally.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureServer, launchBrowser, openPage, PORT, ROOT, URL_BASE, resultsPath,
} from './lib/harness.mjs';

const PAGE_URL = `${URL_BASE}/?test=1&warmup=1&warmupRace=1`;
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();
const failures = [];
const report = {
  scope: 'audio-startup',
  url: PAGE_URL,
  port: PORT,
  sourceHashes: {
    audio: sha256(join(ROOT, 'src', 'audio.js')),
    main: sha256(join(ROOT, 'src', 'main.js')),
    test: sha256(fileURLToPath(import.meta.url)),
    harness: sha256(join(ROOT, 'tests', 'lib', 'harness.mjs')),
  },
  renderer: null,
  activation: null,
  graphFailure: null,
  completion: null,
  earlyThrow: null,
  cancellation: null,
  browserErrors: [],
  failures,
};
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};
const max = (values) => Math.max(0, ...(values || []).filter(Number.isFinite));

async function waitReady(page) {
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null,
    { timeout: 90000, polling: 100 },
  );
}

async function runShippingActivation(browser) {
  const opened = await openPage(browser, `${URL_BASE}/`);
  const { page } = opened;
  try {
    await page.waitForFunction(
      () => window.__game?.audio?.ctx && window.__game?._reducedBootstrapReady?.(),
      null,
      { timeout: 90000, polling: 100 },
    );
    await page.evaluate(async () => {
      const ctx = window.__game.audio.ctx;
      if (ctx.state === 'running') await ctx.suspend();
    });
    await page.evaluate(() => {
      const g = window.__game;
      const sequence = [];
      const realInit = g.audio.init;
      const realPointerLock = g._requestPointerLock;
      const preparedContext = g.audio.ctx;
      const realResume = preparedContext.resume;
      let actualResumeCalls = 0;
      preparedContext.resume = function tracedShippingResume(...args) {
        actualResumeCalls++;
        sequence.push({ event: 'audio-resume', at: performance.now() });
        return realResume.apply(this, args);
      };
      g.audio.init = function tracedShippingAudioInit(...args) {
        const at = performance.now();
        sequence.push({ event: 'audio-init-start', at });
        try { return realInit.apply(this, args); }
        finally { sequence.push({ event: 'audio-init-end', at: performance.now() }); }
      };
      g._requestPointerLock = function tracedShippingPointerLock(...args) {
        sequence.push({ event: 'pointer-lock-request', at: performance.now() });
        return realPointerLock.apply(this, args);
      };
      window.__AUDIO_ACTIVATION_PROBE__ = {
        sequence, realInit, realPointerLock, realResume, preparedContext,
        actualResumeCalls: () => actualResumeCalls,
        before: {
          started: g.started,
          graphInitialized: g.audio._graphInitialized,
          contextState: g.audio.ctx.state,
          startupStatus: g.audio.startupBake.status,
          resumeCalls: g.audio.startupBake.resumeCalls,
          resumeError: g.audio.startupBake.resumeError,
        },
      };
    });
    await page.click('[data-action="start"]');
    await page.waitForFunction(() => {
      const g = window.__game;
      return g.started && g.audio._graphInitialized
        && ['scheduled', 'planning', 'baking', 'ready'].includes(g.audio.startupBake?.status)
        && g.audio.ctx?.state === 'running'
        && document.pointerLockElement === g.renderer.domElement;
    }, null, { timeout: 5000, polling: 25 });
    const value = await page.evaluate(() => {
      const g = window.__game;
      const probe = window.__AUDIO_ACTIVATION_PROBE__;
      g.audio.init = probe.realInit;
      g._requestPointerLock = probe.realPointerLock;
      probe.preparedContext.resume = probe.realResume;
      const result = {
        before: probe.before,
        sequence: probe.sequence,
        samePreparedContext: g.audio.ctx === probe.preparedContext,
        started: g.started,
        graphInitialized: g.audio._graphInitialized,
        contextState: g.audio.ctx?.state || null,
        resumeCalls: g.audio.startupBake?.resumeCalls ?? null,
        resumeError: g.audio.startupBake?.resumeError ?? null,
        actualResumeCalls: probe.actualResumeCalls(),
        startupStatus: g.audio.startupBake?.status || null,
        pointerLocked: document.pointerLockElement === g.renderer.domElement,
        renderer: (() => {
          const gl = g.renderer.getContext();
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        })(),
      };
      g.audio.stopAll({ suspend: true });
      delete window.__AUDIO_ACTIVATION_PROBE__;
      return result;
    });
    return { value, errors: [...opened.errors] };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runGraphFailure(browser) {
  const opened = await openPage(browser, `${URL_BASE}/`);
  const { page } = opened;
  try {
    await page.waitForFunction(
      () => window.__game?.audio?.ctx && window.__game?._reducedBootstrapReady?.(),
      null,
      { timeout: 90000, polling: 100 },
    );
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.audio.ctx;
      const realCreateBiquadFilter = ctx.createBiquadFilter;
      const realRender = g.render;
      const probe = { ctx, realCreateBiquadFilter, realRender, maxWorldDrawCalls: 0 };
      g.render = function trackPlayableWorld(...args) {
        const result = realRender.apply(this, args);
        probe.maxWorldDrawCalls = Math.max(
          probe.maxWorldDrawCalls,
          g.lastRender?.worldDrawCalls || 0,
        );
        return result;
      };
      let injected = false;
      ctx.createBiquadFilter = function injectedGraphFailure(...args) {
        if (!injected) {
          injected = true;
          throw new Error('injected-audio-graph-failure');
        }
        return realCreateBiquadFilter.apply(this, args);
      };
      window.__AUDIO_GRAPH_FAILURE_PROBE__ = probe;
    });
    await page.click('[data-action="start"]');
    await page.waitForFunction(() => {
      const g = window.__game;
      return g.started
        && g.el.title.classList.contains('hidden')
        && g.act === 'bedroom'
        && g.audio.startupBake?.status === 'failed'
        && window.__AUDIO_GRAPH_FAILURE_PROBE__?.maxWorldDrawCalls > 0
        && document.pointerLockElement === g.renderer.domElement;
    }, null, { timeout: 10000, polling: 25 });
    const value = await page.evaluate(() => {
      const g = window.__game;
      const probe = window.__AUDIO_GRAPH_FAILURE_PROBE__;
      probe.ctx.createBiquadFilter = probe.realCreateBiquadFilter;
      g.render = probe.realRender;
      const gl = g.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const result = {
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        started: g.started,
        titleHidden: g.el.title.classList.contains('hidden'),
        act: g.act,
        directorBeats: g.director.beats.length,
        pointerLocked: document.pointerLockElement === g.renderer.domElement,
        maxWorldDrawCalls: probe.maxWorldDrawCalls,
        audioStatus: g.audio.startupBake?.status || null,
        audioError: g.audio.startupBake?.error || null,
        graphInitialized: !!g.audio._graphInitialized,
        ready: g.audio.ready,
        masterValue: g.audio.master?.gain?.value ?? null,
      };
      g.audio.stopAll({ suspend: true });
      delete window.__AUDIO_GRAPH_FAILURE_PROBE__;
      return result;
    });
    return { value, errors: [...opened.errors] };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runCompletion(browser) {
  const opened = await openPage(browser, PAGE_URL);
  const { page } = opened;
  try {
    await waitReady(page);
    await page.evaluate(async () => {
      const ctx = window.__game.audio.ctx;
      if (ctx.state === 'running') await ctx.suspend();
    });
    await page.evaluate(() => {
      const g = window.__game;
      const gameplay = () => ({
        act: g.act,
        time: g.time,
        player: [g.player.pos.x, g.player.pos.y, g.player.pos.z, g.player.yaw, g.player.pitch],
        flags: [...g.flags].sort(),
        enemies: g.enemies.list.map((enemy) => ({
          uuid: enemy.mesh.uuid,
          kind: enemy.kind,
          state: enemy.state,
          parent: enemy.mesh.parent?.uuid || null,
        })),
        choir: g.enemies.choir?.mesh?.uuid || null,
        spawnSerial: g.enemies._spawnSerial,
        spawnLog: JSON.stringify(g.spawnLog || []),
        skullStage: g.skull.stage,
        skullMode: g.skull.mode,
        skullParent: g.skull.root.parent?.uuid || null,
        finaleActive: g.finale.active,
        finalePhase: g.finale.phase,
        audioLoops: g.audio._loops?.size || 0,
        forestLoops: g.audio._forestStoryLoops?.size || 0,
        audioZone: g.audio._zone,
      });
      const compactStartup = () => JSON.parse(JSON.stringify(g.audio.startupBake));
      const probe = {
        gameplay,
        compactStartup,
        renderRows: [],
        observedIntervals: [],
        orderingErrors: [],
        audioInitCalls: [],
        frameSerial: 0,
        lastCompleted: null,
        previousObserved: null,
        active: false,
        sampling: true,
        pendingInjected: false,
        pendingRepeat: null,
        startAt: null,
        returnedAt: null,
        renderStartIndex: 0,
        afterReturn: null,
        audioPreparation: {
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
          shaderWarmupStatus: g.shaderWarmup?.status || null,
          shaderWarmupReason: g.shaderWarmup?.reason || null,
        },
        bufferSourcesCreated: 0,
        bufferSources: [],
      };

      const startupContext = g.audio.ctx;
      const realCreateBufferSource = startupContext?.createBufferSource;
      if (startupContext && typeof realCreateBufferSource === 'function') {
        startupContext.createBufferSource = function tracedCreateBufferSource(...args) {
          probe.bufferSourcesCreated++;
          const source = realCreateBufferSource.apply(this, args);
          const realStart = source.start;
          const record = { source, startCalls: 0 };
          source.start = function tracedStartupSourceStart(...startArgs) {
            record.startCalls++;
            return realStart.apply(this, startArgs);
          };
          probe.bufferSources.push(record);
          return source;
        };
      }

      const realRender = g.render;
      g.render = function measuredAudioRender(...args) {
        const startedAt = performance.now();
        try { return realRender.apply(this, args); }
        finally {
          const completedAt = performance.now();
          const row = {
            frameId: ++probe.frameSerial,
            startedAt,
            completedAt,
            durationMs: completedAt - startedAt,
            audioReady: g.audio.ready,
            audioStatus: g.audio.startupBake?.status || null,
            audioCompleted: g.audio.startupBake?.completed || 0,
          };
          probe.renderRows.push(row);
          probe.lastCompleted = row;
        }
      };

      const sample = () => {
        if (!probe.sampling) return;
        const observedAt = performance.now();
        const completed = probe.lastCompleted;
        if (probe.active && completed
            && completed.frameId !== probe.previousObserved?.frameId) {
          const current = { ...completed, observedAt };
          if (probe.previousObserved) {
            const ordered = current.frameId > probe.previousObserved.frameId
              && current.completedAt <= current.observedAt
              && probe.previousObserved.completedAt <= probe.previousObserved.observedAt;
            if (ordered) {
              probe.observedIntervals.push(current.observedAt - probe.previousObserved.observedAt);
            } else if (probe.orderingErrors.length < 16) {
              probe.orderingErrors.push({ previous: probe.previousObserved, current });
            }
          }
          probe.previousObserved = current;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);

      const realAudioInit = g.audio.init;
      const measureAudioInit = (kind, invoke) => {
        const startedAt = performance.now();
        try { return invoke(); }
        finally {
          const completedAt = performance.now();
          probe.audioInitCalls.push({ kind, startedAt, completedAt, durationMs: completedAt - startedAt });
        }
      };
      g.audio.init = function measuredAudioInit(...args) {
        const result = measureAudioInit(
          probe.audioInitCalls.length ? 'post-ready-repeat' : 'natural',
          () => realAudioInit.apply(this, args),
        );
        if (!probe.pendingInjected) {
          probe.pendingInjected = true;
          const audio = this;
          queueMicrotask(() => {
            const context = audio.ctx;
            const before = {
              token: audio._startupBakeToken,
              status: audio.startupBake.status,
              pending: audio.startupBake.pending,
              queue: audio._startupBakeQueue,
              raf: audio._startupBakeRaf,
              timer: audio._startupBakeTimer,
              watchdog: audio._startupBakeWatchdog,
            };
            measureAudioInit('pending-repeat', () => realAudioInit.apply(audio, args));
            const after = {
              token: audio._startupBakeToken,
              status: audio.startupBake.status,
              pending: audio.startupBake.pending,
              queue: audio._startupBakeQueue,
              raf: audio._startupBakeRaf,
              timer: audio._startupBakeTimer,
              watchdog: audio._startupBakeWatchdog,
            };
            probe.pendingRepeat = {
              sameContext: audio.ctx === context,
              sameToken: before.token === after.token,
              sameStatus: before.status === after.status,
              samePending: before.pending === after.pending,
              sameQueue: before.queue === after.queue,
              sameRaf: before.raf === after.raf,
              sameTimer: before.timer === after.timer,
              sameWatchdog: before.watchdog === after.watchdog,
              before: {
                token: before.token,
                status: before.status,
                pending: before.pending,
                queueIsNull: before.queue == null,
                hasRaf: before.raf != null,
                hasTimer: before.timer != null,
                hasWatchdog: before.watchdog != null,
              },
              after: {
                token: after.token,
                status: after.status,
                pending: after.pending,
                queueIsNull: after.queue == null,
                hasRaf: after.raf != null,
                hasTimer: after.timer != null,
                hasWatchdog: after.watchdog != null,
              },
            };
          });
        }
        return result;
      };

      const realStartGame = g.startGame;
      g.startGame = function measuredStart(...args) {
        probe.startAt = performance.now();
        probe.renderStartIndex = probe.renderRows.length;
        probe.previousObserved = null;
        probe.active = true;
        g._selfStep = false;
        try { return realStartGame.apply(this, args); }
        finally {
          probe.returnedAt = performance.now();
          probe.afterReturn = gameplay();
          probe.warmupAfterReturn = {
            status: g.shaderWarmup?.status || null,
            reason: g.shaderWarmup?.reason || null,
          };
        }
      };

      probe.before = gameplay();
      probe.realRender = realRender;
      probe.realAudioInit = realAudioInit;
      probe.realStartGame = realStartGame;
      probe.startupContext = startupContext;
      probe.realCreateBufferSource = realCreateBufferSource;
      window.__AUDIO_STARTUP_PROBE__ = probe;
    });

    // Use the actual title control so prepared-context resume and silent graph
    // initialization happen on the shipping activation path, not the debug API.
    await page.click('[data-action="start"]');

    const value = await page.evaluate(async () => {
      const g = window.__game;
      const probe = window.__AUDIO_STARTUP_PROBE__;
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const progressSignature = () => {
        const startup = g.audio.startupBake;
        const last = startup?.slices?.at(-1);
        return JSON.stringify([
          g.audio.ready, g.audio.ctx?.state, startup?.status,
          startup?.slices?.length, startup?.completed, startup?.totalPrimitives,
          startup?.pending, startup?.droppedSlices, startup?.scheduler,
          last?.index, last?.labels?.join('|'), last?.remaining,
          startup?.error, startup?.cancelReason, startup?.resumeError,
        ]);
      };
      const stableReady = () => {
        const startup = g.audio.startupBake;
        const sourceSchema = probe.bufferSources.map(({ source, startCalls }) => ({
          startCalls,
          loop: source.loop,
          buffer: source.buffer === g.audio._noiseBuf
            ? 'noise'
            : source.buffer === g.audio._crickLoop ? 'cricket' : 'other',
        }));
        return {
          context: g.audio.ctx,
          token: g.audio._startupBakeToken,
          startupSourcesStarted: g.audio._startupSourcesStarted,
          requestedAt: startup.requestedAt,
          contextCreatedAt: startup.contextCreatedAt,
          startedAt: startup.startedAt,
          readyAt: startup.readyAt,
          durationMs: startup.durationMs,
          totalLatencyMs: startup.totalLatencyMs,
          totalPrimitives: startup.totalPrimitives,
          completed: startup.completed,
          pending: startup.pending,
          droppedSlices: startup.droppedSlices,
          maxSliceMs: startup.maxSliceMs,
          maxPrimitiveMs: startup.maxPrimitiveMs,
          bufferSourcesCreated: probe.bufferSourcesCreated,
          sourceSchema: JSON.stringify(sourceSchema),
          slices: JSON.stringify(startup.slices),
        };
      };
      const serialStableReady = (snapshot) => ({
        ...snapshot,
        context: snapshot.context ? 'same-live-context' : null,
      });

      let waitError = null;
      let signature = progressSignature();
      const hardDeadline = performance.now() + 5000;
      let progressDeadline = performance.now() + 1000;
      while (!(g.audio.ready && g.audio.startupBake?.status === 'ready')
          && performance.now() < hardDeadline) {
        const startup = g.audio.startupBake;
        if (!startup || ['failed', 'cancelled'].includes(startup.status)
            || g.audio.ctx?.state === 'closed') {
          waitError = `terminal:${progressSignature()}`;
          break;
        }
        const next = progressSignature();
        if (next !== signature) {
          signature = next;
          progressDeadline = performance.now() + 1000;
        } else if (performance.now() >= progressDeadline) {
          waitError = `no-progress:${signature}`;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (!(g.audio.ready && g.audio.startupBake?.status === 'ready') && !waitError) {
        waitError = `hard-timeout:${progressSignature()}`;
      }

      const afterReady = probe.gameplay();
      const startupBeforeRepeat = probe.compactStartup();
      const resources = {
        startupSourcesStarted: !!g.audio._startupSourcesStarted,
        impulseBuffers: Object.fromEntries(Object.entries(g.audio._convolvers || {})
          .map(([kind, convolver]) => [kind, convolver.buffer ? {
            channels: convolver.buffer.numberOfChannels,
            length: convolver.buffer.length,
            sampleRate: convolver.buffer.sampleRate,
          } : null])),
        noiseSamples: g.audio._noiseBuf?.length || 0,
        cricketSamples: g.audio._crickLoop?.length || 0,
        contextSampleRate: g.audio.ctx?.sampleRate || 0,
        stepCounts: {
          wood: g.audio._steps?.wood?.length || 0,
          stone: g.audio._steps?.stone?.length || 0,
          dirt: g.audio._steps?.dirt?.length || 0,
          leaves: g.audio._steps?.leaves?.length || 0,
        },
        sourceSchema: probe.bufferSources.map(({ source, startCalls }) => ({
          startCalls,
          loop: source.loop,
          buffer: source.buffer === g.audio._noiseBuf
            ? 'noise'
            : source.buffer === g.audio._crickLoop ? 'cricket' : 'other',
        })),
      };
      const readyBeforeRepeat = stableReady();
      g.audio.init();
      await Promise.resolve();
      await frame();
      await frame();
      await frame();
      const readyAfterRepeat = stableReady();
      const startup = {
        ...probe.compactStartup(),
        bufferSourcesCreated: probe.bufferSourcesCreated,
      };
      const readyRepeat = {
        sameContext: readyBeforeRepeat.context === readyAfterRepeat.context,
        unchanged: JSON.stringify(serialStableReady(readyBeforeRepeat))
          === JSON.stringify(serialStableReady(readyAfterRepeat)),
        before: serialStableReady(readyBeforeRepeat),
        after: serialStableReady(readyAfterRepeat),
      };
      const afterRepeat = probe.gameplay();

      probe.active = false;
      probe.sampling = false;
      await frame();
      g.render = probe.realRender;
      g.audio.init = probe.realAudioInit;
      g.startGame = probe.realStartGame;
      if (probe.startupContext && probe.realCreateBufferSource) {
        probe.startupContext.createBufferSource = probe.realCreateBufferSource;
      }

      const renderRows = probe.renderRows.slice(probe.renderStartIndex);
      const renderer = (() => {
        const gl = g.renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      })();
      const result = {
        renderer,
        waitError,
        startMs: probe.returnedAt - probe.startAt,
        wakeTaskMs: (probe.audioInitCalls[0]?.completedAt ?? probe.returnedAt) - probe.startAt,
        instrumentedWakeTaskMs: (probe.audioInitCalls[1]?.completedAt
          ?? probe.audioInitCalls[0]?.completedAt ?? probe.returnedAt) - probe.startAt,
        audioPreparation: probe.audioPreparation,
        warmupAfterReturn: probe.warmupAfterReturn,
        warmupAfterReady: {
          status: g.shaderWarmup?.status || null,
          reason: g.shaderWarmup?.reason || null,
          startedAt: g.shaderWarmup?.startedAt ?? null,
        },
        firstRenderMs: renderRows[0] ? renderRows[0].completedAt - probe.startAt : null,
        before: probe.before,
        afterReturn: probe.afterReturn,
        afterReady,
        afterRepeat,
        pendingRepeat: probe.pendingRepeat,
        readyRepeat,
        startupBeforeRepeat,
        audioInitCalls: probe.audioInitCalls,
        startup,
        resources,
        renderRows,
        observedIntervals: probe.observedIntervals,
        orderingErrors: probe.orderingErrors,
        timing: {
          renderCount: renderRows.length,
          rafIntervals: probe.observedIntervals.length,
          maxRenderMs: Math.max(0, ...renderRows.map((row) => row.durationMs)),
          maxRenderStartIntervalMs: Math.max(0, ...renderRows.slice(1)
            .map((row, index) => row.startedAt - renderRows[index].startedAt)),
          maxInterRenderIdleMs: Math.max(0, ...renderRows.slice(1)
            .map((row, index) => row.startedAt - renderRows[index].completedAt)),
          maxRenderCompletionIntervalMs: Math.max(0, ...renderRows.slice(1)
            .map((row, index) => row.completedAt - renderRows[index].completedAt)),
          maxObservedRafMs: Math.max(0, ...probe.observedIntervals),
        },
      };
      g.audio.stopAll({ suspend: true });
      delete window.__AUDIO_STARTUP_PROBE__;
      return result;
    });

    return { value, errors: [...opened.errors] };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runCancellation(browser) {
  const opened = await openPage(browser, PAGE_URL);
  const { page } = opened;
  try {
    await waitReady(page);
    await page.evaluate(async () => {
      const ctx = window.__game.audio.ctx;
      if (ctx.state === 'running') await ctx.suspend();
    });
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.audio.ctx;
      const realResume = ctx.resume;
      const realSuspend = ctx.suspend;
      const probe = {
        beforeStop: null,
        afterStop: null,
        actualResumeCalls: 0,
        actualSuspendCalls: 0,
      };
      ctx.resume = function tracedCancellationResume(...args) {
        probe.actualResumeCalls++;
        return realResume.apply(this, args);
      };
      ctx.suspend = function tracedCancellationSuspend(...args) {
        probe.actualSuspendCalls++;
        return realSuspend.apply(this, args);
      };
      const snapshot = () => ({
        ready: g.audio.ready,
        status: g.audio.startupBake.status,
        initCalls: g.audio.startupBake.initCalls,
        token: g.audio._startupBakeToken,
        completed: g.audio.startupBake.completed,
        totalPrimitives: g.audio.startupBake.totalPrimitives,
        pending: g.audio.startupBake.pending,
        droppedSlices: g.audio.startupBake.droppedSlices,
        slices: JSON.stringify(g.audio.startupBake.slices),
        readyAt: g.audio.startupBake.readyAt,
        cancelReason: g.audio.startupBake.cancelReason,
        error: g.audio.startupBake.error,
        startupSourcesStarted: g.audio._startupSourcesStarted,
        queueIsNull: g.audio._startupBakeQueue == null,
        rafIsNull: g.audio._startupBakeRaf == null,
        timerIsNull: g.audio._startupBakeTimer == null,
        watchdogIsNull: g.audio._startupBakeWatchdog == null,
        masterValue: g.audio.master?.gain?.value ?? null,
        contextState: g.audio.ctx?.state || null,
        resumeCalls: g.audio.startupBake.resumeCalls,
        actualResumeCalls: probe.actualResumeCalls,
        actualSuspendCalls: probe.actualSuspendCalls,
        terminalSuspendTimerIsNull: g.audio._suspendTimer == null,
        terminalSuspendPromiseIsNull: g.audio._suspendPromise == null,
        stopped: !!g.audio._stopped,
      });
      const realInit = g.audio.init;
      g.audio.init = function cancelPendingStartup(...args) {
        const result = realInit.apply(this, args);
        probe.beforeStop = snapshot();
        this.stopAll({ suspend: true });
        probe.afterStop = snapshot();
        g.audio.init = realInit;
        return result;
      };
      g._selfStep = false;
      window.__AUDIO_CANCEL_PROBE__ = {
        probe, snapshot, realInit, ctx, realResume, realSuspend,
      };
    });

    await page.click('[data-action="start"]');
    await page.waitForFunction(
      () => {
        const g = window.__game;
        const probe = window.__AUDIO_CANCEL_PROBE__?.probe;
        return probe?.actualSuspendCalls === 1
          && g?.audio?.ctx?.state === 'suspended'
          && g.audio._resumePromise == null
          && g.audio._suspendTimer == null
          && g.audio._suspendPromise == null;
      },
      null,
      { timeout: 3000, polling: 25 },
    );
    const value = await page.evaluate(async () => {
      const g = window.__game;
      const {
        probe, snapshot, realInit, ctx, realResume, realSuspend,
      } = window.__AUDIO_CANCEL_PROBE__;
      const afterWait = snapshot();
      realInit.call(g.audio);
      const afterRepeatImmediate = snapshot();
      await Promise.resolve();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const afterRepeat = snapshot();
      ctx.resume = realResume;
      ctx.suspend = realSuspend;
      delete window.__AUDIO_CANCEL_PROBE__;
      return {
        beforeStop: probe.beforeStop,
        afterStop: probe.afterStop,
        afterWait,
        afterRepeatImmediate,
        afterRepeat,
      };
    });
    return { value, errors: [...opened.errors] };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runEarlyThrow(browser) {
  const opened = await openPage(browser, PAGE_URL);
  const { page } = opened;
  try {
    await waitReady(page);
    await page.evaluate(() => {
      const g = window.__game;
      const F = window.__FETCH;
      g._selfStep = false;
      const realStartGame = g.startGame;
      const probe = { outbound: null, realStartGame };
      g.startGame = function throwBeforeFirstAudioPaint(...args) {
        const result = realStartGame.apply(this, args);
        F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
        F.stepWith(0.08, { throwHeld: true }, false);
        probe.outbound = {
          skullMode: g.skull.mode,
          audioReady: g.audio.ready,
          pending: g.audio._pendingMoan ? {
            pos: { ...g.audio._pendingMoan.pos },
            speed: g.audio._pendingMoan.speed,
            tension: g.audio._pendingMoan.tension,
          } : null,
          skullPos: { x: g.skull.pos.x, y: g.skull.pos.y, z: g.skull.pos.z },
        };
        g.startGame = realStartGame;
        return result;
      };
      window.__AUDIO_EARLY_THROW_PROBE__ = probe;
    });
    await page.click('[data-action="start"]');
    const value = await page.evaluate(async () => {
      const g = window.__game;
      const F = window.__FETCH;
      const probe = window.__AUDIO_EARLY_THROW_PROBE__;
      const outbound = probe.outbound;
      const deadline = performance.now() + 5000;
      let signature = '';
      let progressDeadline = performance.now() + 1000;
      while (!(g.audio.ready && g.audio.startupBake?.status === 'ready')
          && performance.now() < deadline) {
        const startup = g.audio.startupBake;
        if (!startup || ['failed', 'cancelled'].includes(startup.status)) break;
        const next = JSON.stringify([
          startup.status, startup.completed, startup.totalPrimitives, startup.pending,
          startup.slices?.length, startup.slices?.at(-1)?.labels?.join('|'),
        ]);
        if (next !== signature) {
          signature = next;
          progressDeadline = performance.now() + 1000;
        } else if (performance.now() >= progressDeadline) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const realized = {
        ready: g.audio.ready,
        status: g.audio.startupBake?.status || null,
        pendingCleared: g.audio._pendingMoan == null,
        moanActive: !!g.audio._moan,
        skullMode: g.skull.mode,
      };
      F.stepWith(1 / 120, { throwReleased: true }, false);
      for (let i = 0; i < 360 && g.skull.mode !== 'held'; i++) F.stepWith(1 / 120, {}, false);
      const caught = {
        skullMode: g.skull.mode,
        pendingCleared: g.audio._pendingMoan == null,
        moanStopped: g.audio._moan == null,
      };
      const gl = g.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      g.audio.stopAll({ suspend: true });
      g.startGame = probe.realStartGame;
      delete window.__AUDIO_EARLY_THROW_PROBE__;
      return { renderer, outbound, realized, caught };
    });
    return { value, errors: [...opened.errors] };
  } finally {
    await page.close().catch(() => {});
  }
}

let server = null;
let browser = null;
let exit = 0;
try {
  server = await ensureServer();
  browser = await launchBrowser({ allowAutoplay: false });

  const activation = await runShippingActivation(browser);
  report.activation = activation.value;
  report.browserErrors.push(...activation.errors.map((error) => `activation: ${error}`));
  const activationEvents = report.activation?.sequence?.map((entry) => entry.event) || [];
  const activationInit = report.activation?.sequence?.filter((entry) =>
    entry.event.startsWith('audio-init')) || [];
  check(/(?:D3D11|Direct3D11)/i.test(report.activation?.renderer || '')
      && report.activation?.before?.started === false
      && report.activation.before.graphInitialized === false
      && report.activation.before.contextState === 'suspended'
      && report.activation.before.startupStatus === 'idle'
      && report.activation.before.resumeCalls === 0
      && report.activation.before.resumeError == null
      && report.activation.samePreparedContext
      && report.activation.started && report.activation.graphInitialized
      && report.activation.contextState === 'running'
      && report.activation.resumeCalls === 1
      && report.activation.actualResumeCalls === 1
      && report.activation.resumeError == null
      && ['scheduled', 'planning', 'baking', 'ready'].includes(report.activation.startupStatus)
      && report.activation.pointerLocked
      && JSON.stringify(activationEvents.slice(0, 4)) === JSON.stringify([
        'audio-init-start', 'audio-resume', 'audio-init-end', 'pointer-lock-request',
      ])
      && activationInit.length === 2
      && activationInit[1].at - activationInit[0].at < 50,
    'shipping title activation resumes the prepared context and builds its silent graph before requesting pointer lock',
    report.activation);

  const graphFailure = await runGraphFailure(browser);
  report.graphFailure = graphFailure.value;
  report.browserErrors.push(...graphFailure.errors.map((error) => `graph-failure: ${error}`));
  check(/(?:D3D11|Direct3D11)/i.test(report.graphFailure?.renderer || '')
      && report.graphFailure.started && report.graphFailure.titleHidden
      && report.graphFailure.act === 'bedroom'
      && report.graphFailure.directorBeats >= 2
      && report.graphFailure.pointerLocked
      && report.graphFailure.maxWorldDrawCalls > 0
      && report.graphFailure.audioStatus === 'failed'
      && /injected-audio-graph-failure/.test(report.graphFailure.audioError || '')
      && report.graphFailure.graphInitialized === false
      && report.graphFailure.ready === false
      && report.graphFailure.masterValue === 0,
    'a synchronous WebAudio graph failure degrades to exact silence without consuming or stranding Wake',
    report.graphFailure);

  const completion = await runCompletion(browser);
  report.completion = completion.value;
  report.browserErrors.push(...completion.errors.map((error) => `completion: ${error}`));
  report.renderer = report.completion?.renderer || null;

  const startup = report.completion?.startup;
  const slices = startup?.slices || [];
  const primitiveSlices = slices.slice(1);
  check(/(?:D3D11|Direct3D11)/i.test(report.renderer || ''),
    'focused audio startup runs in real ANGLE D3D11', report.renderer);
  check(report.completion?.audioPreparation?.contextExists
      && report.completion.audioPreparation.contextState === 'suspended'
      && report.completion.audioPreparation.graphInitialized === false
      && report.completion.audioPreparation.masterExists === false
      && report.completion.audioPreparation.startupSourcesStarted === false
      && report.completion.audioPreparation.ready === false
      && report.completion.audioPreparation.status === 'idle'
      && report.completion.audioPreparation.prepareCalls === 1
      && report.completion.audioPreparation.shaderWarmupStatus === 'scheduled'
      && Number.isFinite(report.completion.audioPreparation.contextPrepareStartedAt)
      && Number.isFinite(report.completion.audioPreparation.contextPrepareReadyAt)
      && Number.isFinite(report.completion.audioPreparation.contextCreatedAt)
      && report.completion.audioPreparation.contextPrepareStartedAt
        <= report.completion.audioPreparation.contextCreatedAt
      && report.completion.audioPreparation.contextCreatedAt
        === report.completion.audioPreparation.contextPrepareReadyAt
      && Number.isFinite(report.completion.audioPreparation.contextPrepareMs)
      && report.completion.audioPreparation.contextPrepareMs
        === report.completion.audioPreparation.contextPrepareReadyAt
          - report.completion.audioPreparation.contextPrepareStartedAt
      && report.completion.audioPreparation.contextPrepareMs < 500
      && report.completion.audioPreparation.contextPrepareError == null,
    'title-time preparation owns native context creation without building or starting the audio graph',
    report.completion?.audioPreparation);
  check(report.completion?.waitError == null,
    'audio startup reaches ready without timeout or terminal state', report.completion?.waitError);
  check(report.completion?.startMs < 50
      && report.completion?.wakeTaskMs < 50
      && report.completion?.audioInitCalls?.length === 3
      && report.completion.audioInitCalls.slice(0, 2).every((call) => call.durationMs < 50)
      && report.completion.warmupAfterReturn?.status === 'scheduled'
      && ['bootstrap-wait', 'pending', 'ready', 'degraded']
        .includes(report.completion.warmupAfterReady?.status),
    'the real Wake click, synchronous gesture-owned graph setup and pending-repeat probe stay below 50ms while warmup begins on the next task', {
      startMs: report.completion?.startMs,
      wakeTaskMs: report.completion?.wakeTaskMs,
      initCalls: report.completion?.audioInitCalls,
      warmupAfterReturn: report.completion?.warmupAfterReturn,
      warmupAfterReady: report.completion?.warmupAfterReady,
    });
  check(report.completion?.afterReturn?.audioLoops === 0
      && report.completion?.pendingRepeat?.sameContext
      && report.completion.pendingRepeat.sameToken
      && report.completion.pendingRepeat.sameStatus
      && report.completion.pendingRepeat.samePending
      && report.completion.pendingRepeat.sameQueue
      && report.completion.pendingRepeat.sameRaf
      && report.completion.pendingRepeat.sameTimer
      && report.completion.pendingRepeat.sameWatchdog
      && report.completion.pendingRepeat.before.status === 'scheduled'
      && report.completion.pendingRepeat.before.pending === 1,
    'a repeated init during pending startup reuses the exact context, token, queue and scheduler',
    report.completion?.pendingRepeat);
  check(startup?.status === 'ready'
      && startup.initCalls === 3
      && startup.resumeCalls === 1
      && startup.contextState === 'running'
      && startup.error == null && startup.resumeError == null && startup.cancelReason == null
      && Number.isFinite(startup.contextCreatedAt) && Number.isFinite(startup.requestedAt)
      && Number.isFinite(startup.startedAt) && Number.isFinite(startup.readyAt)
      && startup.contextPrepareStartedAt
        === report.completion.audioPreparation.contextPrepareStartedAt
      && startup.contextPrepareReadyAt
        === report.completion.audioPreparation.contextPrepareReadyAt
      && startup.contextCreatedAt === report.completion.audioPreparation.contextCreatedAt
      && startup.contextPrepareReadyAt <= startup.requestedAt
      && startup.contextCreatedAt <= startup.requestedAt
      && startup.requestedAt <= startup.startedAt && startup.startedAt <= startup.readyAt
      && startup.durationMs === startup.readyAt - startup.startedAt
      && startup.totalLatencyMs === startup.readyAt - startup.requestedAt
      && startup.primitiveLimit === 1 && startup.pcmChunkSamples === 12000
      && startup.totalPrimitives > 0 && startup.completed === startup.totalPrimitives
      && startup.pending === 0 && startup.droppedSlices === 0
      && startup.bufferSourcesCreated === 4
      && slices.length === startup.totalPrimitives + 1
      && slices.length <= startup.sliceTelemetryLimit
      && slices[0]?.labels?.[0] === 'plan-core-pcm'
      && slices[0]?.primitiveCount === 0
      && slices[0]?.remaining === startup.totalPrimitives
      && primitiveSlices.every((slice, index) => slice.index === index + 1
        && slice.scheduler === 'paint'
        && slice.primitiveCount === 1 && slice.labels?.length === 1
        && slice.remaining === startup.totalPrimitives - index - 1
        && slice.durationMs < 16 && slice.maxPrimitiveMs < 16)
      && slices[0]?.scheduler === 'paint' && slices[0]?.durationMs < 16
      && primitiveSlices.at(-1)?.labels?.[0] === 'activate-core-audio'
      && primitiveSlices.at(-1)?.remaining === 0
      && startup.maxSliceMs < 16 && startup.maxPrimitiveMs < 16
      && startup.durationMs < 2000 && startup.totalLatencyMs < 2000,
    'core audio plans once, bakes one strict sub-16ms primitive per visible paint, and is ready within two seconds',
    startup);
  check(report.completion?.resources?.startupSourcesStarted === true
      && JSON.stringify(Object.keys(report.completion.resources.impulseBuffers || {}).sort())
        === JSON.stringify(['cave', 'interior', 'outdoor'])
      && report.completion.resources.contextSampleRate >= 16000
      && Object.values(report.completion.resources.impulseBuffers || {}).every((buffer) =>
        buffer?.channels === 2 && buffer.length > 0
          && buffer.sampleRate === report.completion.resources.contextSampleRate)
      && report.completion.resources.noiseSamples > 0
      && report.completion.resources.cricketSamples > 0
      && JSON.stringify(report.completion.resources.stepCounts)
        === JSON.stringify({ wood: 3, stone: 3, dirt: 3, leaves: 4 })
      && JSON.stringify(report.completion.resources.sourceSchema)
        === JSON.stringify([
          { startCalls: 1, loop: true, buffer: 'noise' },
          { startCalls: 1, loop: true, buffer: 'noise' },
          { startCalls: 1, loop: true, buffer: 'noise' },
          { startCalls: 1, loop: true, buffer: 'cricket' },
        ]),
    'all three impulses, shared beds, four once-started looping sources and authored footstep families exist before audio activation',
    report.completion?.resources);
  check(JSON.stringify(report.completion?.afterReturn)
      === JSON.stringify(report.completion?.afterReady)
      && JSON.stringify(report.completion?.afterReady)
        === JSON.stringify(report.completion?.afterRepeat),
    'audio baking and both repeat-init calls preserve every sampled gameplay field', {
      afterReturn: report.completion?.afterReturn,
      afterReady: report.completion?.afterReady,
      afterRepeat: report.completion?.afterRepeat,
    });
  check(report.completion?.readyRepeat?.sameContext
      && report.completion.readyRepeat.unchanged,
    'init after ready cannot restart the completed transaction or duplicate its four finite bed sources',
    report.completion?.readyRepeat);
  check(report.completion?.timing?.renderCount > 1
      && report.completion.timing.rafIntervals > 0
      && report.completion.orderingErrors?.length === 0
      && report.completion.firstRenderMs < 100
      && report.completion.timing.maxRenderMs < 100
      && report.completion.timing.maxInterRenderIdleMs < 100
      && report.completion.timing.maxRenderCompletionIntervalMs < 100
      && report.completion.timing.maxObservedRafMs < 100,
    'live audio startup preserves first paint, render, scheduler-idle, completion and observed cadence below 100ms', {
      firstRenderMs: report.completion?.firstRenderMs,
      timing: report.completion?.timing,
      orderingErrors: report.completion?.orderingErrors,
    });

  const earlyThrow = await runEarlyThrow(browser);
  report.earlyThrow = earlyThrow.value;
  report.browserErrors.push(...earlyThrow.errors.map((error) => `early-throw: ${error}`));
  check(/(?:D3D11|Direct3D11)/i.test(report.earlyThrow?.renderer || '')
      && report.earlyThrow?.outbound?.skullMode === 'outbound'
      && report.earlyThrow.outbound.audioReady === false
      && report.earlyThrow.outbound.pending
      && report.earlyThrow.outbound.pending.speed > 0
      && Math.hypot(
        report.earlyThrow.outbound.pending.pos.x - report.earlyThrow.outbound.skullPos.x,
        report.earlyThrow.outbound.pending.pos.y - report.earlyThrow.outbound.skullPos.y,
        report.earlyThrow.outbound.pending.pos.z - report.earlyThrow.outbound.skullPos.z,
      ) < 0.001
      && report.earlyThrow.realized?.ready
      && report.earlyThrow.realized.status === 'ready'
      && report.earlyThrow.realized.pendingCleared
      && report.earlyThrow.realized.moanActive
      && report.earlyThrow.realized.skullMode === 'outbound'
      && report.earlyThrow.caught?.skullMode === 'held'
      && report.earlyThrow.caught.pendingCleared
      && report.earlyThrow.caught.moanStopped,
    'an immediate legal throw carries its live skull voice across deferred startup and stops it on the genuine catch',
    report.earlyThrow);

  const cancellation = await runCancellation(browser);
  report.cancellation = cancellation.value;
  report.browserErrors.push(...cancellation.errors.map((error) => `cancellation: ${error}`));
  const beforeStop = report.cancellation?.beforeStop;
  const afterStop = report.cancellation?.afterStop;
  const afterWait = report.cancellation?.afterWait;
  const afterRepeatImmediate = report.cancellation?.afterRepeatImmediate;
  const afterRepeat = report.cancellation?.afterRepeat;
  check(beforeStop?.ready === false && beforeStop.status === 'scheduled'
      && beforeStop.pending === 1 && beforeStop.startupSourcesStarted === false
      && beforeStop.queueIsNull && !beforeStop.rafIsNull && !beforeStop.watchdogIsNull
      && beforeStop.resumeCalls === 1 && beforeStop.actualResumeCalls === 1,
    'terminal cancellation begins from a real scheduled post-gesture startup', beforeStop);
  const cancelled = (snapshot) => snapshot?.ready === false
    && snapshot.status === 'cancelled' && snapshot.cancelReason === 'stopAll'
    && snapshot.pending === 0 && snapshot.error == null
    && snapshot.startupSourcesStarted === false && snapshot.queueIsNull
    && snapshot.rafIsNull && snapshot.timerIsNull && snapshot.watchdogIsNull
    && snapshot.masterValue === 0;
  check(cancelled(afterStop) && cancelled(afterWait)
      && cancelled(afterRepeatImmediate) && cancelled(afterRepeat)
      && afterStop.token === afterWait.token && afterWait.token === afterRepeat.token
      && afterStop.completed === afterWait.completed && afterWait.completed === afterRepeat.completed
      && afterStop.totalPrimitives === afterWait.totalPrimitives
      && afterWait.totalPrimitives === afterRepeat.totalPrimitives
      && afterStop.slices === afterWait.slices && afterWait.slices === afterRepeat.slices
      && afterStop.droppedSlices === afterWait.droppedSlices
      && afterWait.droppedSlices === afterRepeat.droppedSlices
      && afterStop.readyAt === afterWait.readyAt && afterWait.readyAt === afterRepeat.readyAt
      && afterRepeat.initCalls === 2
      && afterStop.stopped && afterWait.stopped
      && afterRepeatImmediate.stopped && afterRepeat.stopped
      && afterWait.contextState === 'suspended'
      && afterRepeatImmediate.contextState === 'suspended'
      && afterRepeat.contextState === 'suspended'
      && afterWait.actualSuspendCalls === 1
      && afterRepeatImmediate.actualSuspendCalls === 1
      && afterRepeat.actualSuspendCalls === 1
      && afterWait.terminalSuspendTimerIsNull
      && afterWait.terminalSuspendPromiseIsNull
      && afterRepeatImmediate.terminalSuspendTimerIsNull
      && afterRepeatImmediate.terminalSuspendPromiseIsNull
      && afterRepeat.terminalSuspendTimerIsNull
      && afterRepeat.terminalSuspendPromiseIsNull
      && afterRepeatImmediate.resumeCalls === afterWait.resumeCalls
      && afterRepeat.resumeCalls === afterWait.resumeCalls
      && afterRepeatImmediate.actualResumeCalls === afterWait.actualResumeCalls
      && afterRepeat.actualResumeCalls === afterWait.actualResumeCalls,
    'stopAll cancels every pending handle and later init cannot resurrect PCM work or sources',
    report.cancellation);

  check(report.browserErrors.length === 0,
    'focused audio startup has zero browser/page errors', report.browserErrors);
} catch (error) {
  exit = 1;
  failures.push({ message: 'audio startup runner crashed', detail: error?.stack || String(error) });
  console.error(error?.stack || error);
} finally {
  await browser?.close().catch(() => {});
  server?.stop();
  writeFileSync(resultsPath('audio-startup-regression.json'), JSON.stringify(report, null, 2));
}

if (failures.length || report.browserErrors.length) exit = 1;
console.log(`${exit ? 'FAIL' : 'PASS'} audio startup: ${failures.length} failures, ${report.browserErrors.length} browser errors`);
process.exit(exit);

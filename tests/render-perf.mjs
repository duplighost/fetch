// render-perf.mjs -- real rendered-frame performance gate for FETCH.
//
// This is deliberately separate from the deterministic simulation gates. It
// launches the harness's system Chrome on ANGLE/D3D11, leaves FETCH's real rAF
// render loop running, and measures the cadence of frames that actually call
// Game.render(). It then pauses only that automatic render call while issuing
// explicit, isolated Game.render() calls inside EXT_disjoint_timer_query_webgl2
// queries. There is no gl.finish(), no render-free "FPS", and no software-GL
// fallback disguised as performance evidence.
//
// Limits: rAF cadence includes browser scheduling and CPU submission, while GPU
// timer queries cover GPU commands submitted by Game.render() but not compositor
// presentation. Test mode preserves the backbuffer for the visual test suite,
// so this is a slightly conservative rendering configuration.
//
//   node tests/render-perf.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const ACTS = ['forest', 'clearing', 'cave', 'mirror'];
const WARM_RAFS = 75;
const RAF_INTERVALS = 180;
const GPU_SAMPLES = 10;
const MIN_VALID_GPU_SAMPLES = 6;

// Intentionally generous playability gates. The median catches sustained slow
// rendering; p95 catches regular stalls without letting one OS scheduling blip
// condemn an otherwise stable run.
const GATES = Object.freeze({
  rafP50MsMax: 28,
  rafP95MsMax: 50,
  minRenderCoverage: 0.90,
  gpuP95MsMax: 45,
});

const fails = [];
const ok = (condition, message) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`);
  if (!condition) fails.push(message);
};

const finite = (values) => values.filter(Number.isFinite).sort((a, b) => a - b);
const percentile = (values, p) => {
  const sorted = finite(values);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
};
const summarize = (values) => {
  const sorted = finite(values);
  if (!sorted.length) return { count: 0, minMs: null, meanMs: null, p50Ms: null, p95Ms: null, maxMs: null };
  const round = (n) => +n.toFixed(3);
  return {
    count: sorted.length,
    minMs: round(sorted[0]),
    meanMs: round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length),
    p50Ms: round(percentile(sorted, 0.50)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted.at(-1)),
  };
};

const report = {
  pass: false,
  url: `${URL_BASE}/?test=1&mute=1`,
  methodology: {
    browser: 'system Chrome launched by tests/lib/harness.mjs with ANGLE/D3D11',
    viewport: '1280x800 CSS pixels at deviceScaleFactor 1',
    raf: `${RAF_INTERVALS} delivered rAF intervals while FETCH's automatic loop calls Game.render()`,
    gpu: `${GPU_SAMPLES} isolated explicit Game.render() calls per act using EXT_disjoint_timer_query_webgl2 when available`,
    warmup: `${WARM_RAFS} rendered rAF frames per act after deterministic scene setup`,
    caveSetup: 'waterfallTaken is established before the cave scene so the route state is representative',
    exclusions: [
      'rAF cadence is not render-free simulation throughput',
      'GPU query time excludes compositor presentation and CPU simulation',
      'test mode preserveDrawingBuffer overhead remains enabled',
    ],
  },
  gates: GATES,
  environment: null,
  acts: {},
  errors: [],
  fails,
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, report.url);
  report.errors = errors;

  await page.waitForFunction(
    () => window.__FETCH && window.__FETCH.ready === true && window.__game && window.__game.renderer,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.environment = await page.evaluate(() => {
    const g = window.__game;
    const gl = g.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const unmaskedRenderer = debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : null;
    const unmaskedVendor = debug
      ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)
      : null;
    const canvas = g.renderer.domElement;
    const rendererSize = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this; } };
    g.renderer.getSize(rendererSize);
    return {
      userAgent: navigator.userAgent,
      documentVisibility: document.visibilityState,
      documentHidden: document.hidden,
      webglVersion: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor,
      unmaskedRenderer,
      isWebGL2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
      contextLost: gl.isContextLost(),
      viewportCss: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      canvasCss: { width: canvas.clientWidth, height: canvas.clientHeight },
      rendererCss: { width: rendererSize.x, height: rendererSize.y },
      canvasBuffer: { width: canvas.width, height: canvas.height },
      drawingBuffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight },
      pixelRatio: g.renderer.getPixelRatio(),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      timerQueryExtension: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    };
  });

  const env = report.environment;
  const rendererEvidence = `${env.unmaskedRenderer || env.renderer || ''}`;
  ok(env.documentVisibility === 'visible' && env.documentHidden === false,
    `document is visible (visibilityState=${env.documentVisibility}, hidden=${env.documentHidden})`);
  ok(env.isWebGL2 && /^WebGL 2/i.test(env.webglVersion),
    `WebGL2 context (${env.webglVersion})`);
  ok(/D3D11/i.test(rendererEvidence),
    `renderer reports D3D11 (${rendererEvidence})`);
  ok(!/swiftshader|llvmpipe|software rasterizer/i.test(rendererEvidence),
    `renderer is not a known software rasterizer (${rendererEvidence})`);
  ok(!env.contextLost, 'WebGL context is not lost');
  ok(env.canvasBuffer.width === env.drawingBuffer.width && env.canvasBuffer.height === env.drawingBuffer.height,
    `canvas buffer matches effective drawing buffer (${env.drawingBuffer.width}x${env.drawingBuffer.height})`);
  ok(env.drawingBuffer.width > 0 && env.drawingBuffer.height > 0,
    `effective render target is non-zero (${env.drawingBuffer.width}x${env.drawingBuffer.height})`);

  await page.evaluate(() => window.__FETCH.start());

  for (const act of ACTS) {
    const setup = await page.evaluate(async ({ act, warmRafs, intervalCount }) => {
      const g = window.__game;
      const F = window.__FETCH;
      const waitRafs = (count) => new Promise((resolve) => {
        let left = count;
        const next = () => {
          if (--left <= 0) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      });

      // A cave debug teleport must carry the one broken promise with it. This
      // also raises the bridge and prevents the test from profiling an invalid
      // route state in which the skull is still held inside the cave.
      if (act === 'cave' && !g.flags.has('waterfallTaken')) g.director.waterfallTaken();
      F.teleport(act);
      F.step(1 / 120, act === 'mirror' ? 30 : 90, false);
      await waitRafs(warmRafs);

      const originalRender = g.render;
      const submitMs = [];
      let renderCalls = 0;
      g.render = function measuredRender(...args) {
        const before = performance.now();
        try {
          return originalRender.apply(this, args);
        } finally {
          renderCalls++;
          submitMs.push(performance.now() - before);
        }
      };

      const intervals = [];
      let previous = null;
      const started = performance.now();
      await new Promise((resolve) => {
        const sample = (timestamp) => {
          if (previous !== null) intervals.push(timestamp - previous);
          previous = timestamp;
          if (intervals.length >= intervalCount) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const elapsedMs = performance.now() - started;
      g.render = originalRender;

      // Capture renderer statistics immediately after a real full frame. FETCH
      // stores the main-scene counts before its grain overlay pass resets info.
      originalRender.call(g);
      const gl = g.renderer.getContext();
      return {
        act: g.act,
        intervals,
        submitMs,
        elapsedMs,
        renderCalls,
        intervalCount,
        renderCoverage: renderCalls / intervalCount,
        render: {
          drawCalls: g.lastRender.drawCalls,
          triangles: g.lastRender.triangles,
          geometries: g.renderer.info.memory.geometries,
          textures: g.renderer.info.memory.textures,
          programs: g.renderer.info.programs ? g.renderer.info.programs.length : null,
          points: g.renderer.info.render.points,
          lines: g.renderer.info.render.lines,
          frame: g.renderer.info.render.frame,
        },
        effectiveTarget: {
          width: gl.drawingBufferWidth,
          height: gl.drawingBufferHeight,
          currentRenderTargetIsScreen: g.renderer.getRenderTarget() === null,
        },
      };
    }, { act, warmRafs: WARM_RAFS, intervalCount: RAF_INTERVALS });

    const gpu = await page.evaluate(async ({ requested }) => {
      const g = window.__game;
      const gl = g.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) {
        return {
          available: false,
          extension: 'EXT_disjoint_timer_query_webgl2',
          reason: 'extension unavailable; rAF cadence and renderer identity remain gated',
          requested,
          validMs: [],
          discardedDisjoint: 0,
          timedOut: 0,
        };
      }

      const automaticRender = g.render;
      const explicitRender = automaticRender.bind(g);
      const nextRaf = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const validMs = [];
      let discardedDisjoint = 0;
      let timedOut = 0;
      let error = null;

      // The game's rAF callback looks up g.render each frame. Replacing that
      // lookup with a no-op isolates each explicit queried render without
      // stopping rAF itself (which is also our non-blocking query poll clock).
      g.render = () => {};
      try {
        await nextRaf();
        await nextRaf();
        await nextRaf();

        for (let i = 0; i < requested; i++) {
          const query = gl.createQuery();
          if (!query) throw new Error('gl.createQuery() returned null');
          let wasDisjoint = false;
          try {
            gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
            explicitRender();
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            // Non-blocking queue submission only. gl.finish() is intentionally
            // forbidden because it serializes the CPU and GPU and poisons the
            // timing it purports to measure.
            gl.flush();

            const deadline = performance.now() + 5000;
            let available = false;
            while (performance.now() < deadline) {
              await nextRaf();
              wasDisjoint ||= !!gl.getParameter(ext.GPU_DISJOINT_EXT);
              available = !!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
              if (available) break;
            }
            if (!available) {
              timedOut++;
            } else if (wasDisjoint || gl.getParameter(ext.GPU_DISJOINT_EXT)) {
              discardedDisjoint++;
            } else {
              const nanoseconds = gl.getQueryParameter(query, gl.QUERY_RESULT);
              if (Number.isFinite(nanoseconds) && nanoseconds >= 0) validMs.push(nanoseconds / 1e6);
              else discardedDisjoint++;
            }
          } finally {
            gl.deleteQuery(query);
          }
        }
      } catch (e) {
        error = String(e && e.stack || e);
        // A beginQuery failure can leave a query active. End it if Chrome says
        // one is still current so the game's renderer is not poisoned after QA.
        try {
          if (gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) gl.endQuery(ext.TIME_ELAPSED_EXT);
        } catch { /* context/query already clean */ }
      } finally {
        g.render = automaticRender;
      }

      return {
        available: true,
        extension: 'EXT_disjoint_timer_query_webgl2',
        requested,
        validMs,
        discardedDisjoint,
        timedOut,
        error,
      };
    }, { requested: GPU_SAMPLES });

    const rafSummary = summarize(setup.intervals);
    const submitSummary = summarize(setup.submitMs);
    const gpuSummary = summarize(gpu.validMs || []);
    report.acts[act] = {
      actReported: setup.act,
      effectiveTarget: setup.effectiveTarget,
      rendererStats: setup.render,
      raf: {
        ...rafSummary,
        elapsedMs: +setup.elapsedMs.toFixed(3),
        renderedCalls: setup.renderCalls,
        renderCoverage: +setup.renderCoverage.toFixed(3),
        cadenceHzFromMedian: rafSummary.p50Ms ? +(1000 / rafSummary.p50Ms).toFixed(2) : null,
        intervalsOver50Ms: setup.intervals.filter((ms) => ms > 50).length,
        intervalsMs: setup.intervals.map((ms) => +ms.toFixed(3)),
      },
      cpuSubmission: {
        label: 'Game.render() CPU wall time; not GPU time',
        ...submitSummary,
      },
      gpuTimer: {
        available: gpu.available,
        extension: gpu.extension,
        reason: gpu.reason || null,
        requested: gpu.requested,
        valid: (gpu.validMs || []).length,
        discardedDisjoint: gpu.discardedDisjoint,
        timedOut: gpu.timedOut,
        error: gpu.error || null,
        ...gpuSummary,
        samplesMs: (gpu.validMs || []).map((ms) => +ms.toFixed(3)),
      },
    };

    console.log(`\n[${act}] effective target ${setup.effectiveTarget.width}x${setup.effectiveTarget.height}`);
    console.log(`  rAF rendered cadence: p50 ${rafSummary.p50Ms}ms, p95 ${rafSummary.p95Ms}ms, `
      + `${setup.renderCalls} Game.render calls / ${RAF_INTERVALS} sampled intervals`);
    console.log(gpu.available
      ? `  GPU Game.render: ${gpuSummary.count} valid, p50 ${gpuSummary.p50Ms}ms, p95 ${gpuSummary.p95Ms}ms, `
        + `${gpu.discardedDisjoint} disjoint, ${gpu.timedOut} timeout`
      : `  GPU timer unavailable: ${gpu.reason}`);

    ok(setup.act === act, `${act}: scene reports act '${act}' (got '${setup.act}')`);
    ok(rafSummary.count === RAF_INTERVALS,
      `${act}: collected ${RAF_INTERVALS} delivered rAF intervals (got ${rafSummary.count})`);
    ok(setup.renderCoverage >= GATES.minRenderCoverage,
      `${act}: Game.render coverage ${setup.renderCoverage.toFixed(2)} >= ${GATES.minRenderCoverage.toFixed(2)}`);
    ok(rafSummary.p50Ms !== null && rafSummary.p50Ms <= GATES.rafP50MsMax,
      `${act}: rendered rAF p50 ${rafSummary.p50Ms}ms <= ${GATES.rafP50MsMax}ms`);
    ok(rafSummary.p95Ms !== null && rafSummary.p95Ms <= GATES.rafP95MsMax,
      `${act}: rendered rAF p95 ${rafSummary.p95Ms}ms <= ${GATES.rafP95MsMax}ms`);
    ok(setup.effectiveTarget.currentRenderTargetIsScreen,
      `${act}: renderer returned to the screen target after full render`);

    if (gpu.available) {
      ok(!gpu.error, `${act}: GPU timer completed without API error${gpu.error ? ` -- ${gpu.error}` : ''}`);
      ok(gpuSummary.count >= MIN_VALID_GPU_SAMPLES,
        `${act}: ${gpuSummary.count} valid non-disjoint GPU samples >= ${MIN_VALID_GPU_SAMPLES}`);
      ok(gpuSummary.p95Ms !== null && gpuSummary.p95Ms <= GATES.gpuP95MsMax,
        `${act}: explicit Game.render GPU p95 ${gpuSummary.p95Ms}ms <= ${GATES.gpuP95MsMax}ms`);
    } else {
      console.log(`  INFO ${act}: no GPU-time gate because the timer-query extension is unavailable; rAF and renderer gates apply`);
    }

    ok(errors.length === 0,
      `${act}: zero accumulated page/console errors${errors.length ? ` -- ${errors.slice(0, 5).join(' | ')}` : ''}`);
  }
} catch (e) {
  const message = `exception: ${e && e.stack || e}`;
  console.log('FAIL ' + message);
  fails.push(message);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

report.pass = fails.length === 0;
writeFileSync(resultsPath('render-perf.json'), JSON.stringify(report, null, 2));
console.log(fails.length
  ? `\n${fails.length} RENDER-PERF FAILURES:\n${fails.map((failure) => `  - ${failure}`).join('\n')}`
  : '\nRENDER-PERF PASS -- real D3D11 rendering stayed within the playability gates.');
process.exit(fails.length ? 1 : 0);

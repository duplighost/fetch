// Cold-transition profiler for FETCH.
//
// It intentionally runs with ?test=1 so the title-idle shader warm-up is
// skipped, matching the shipping path where a player presses Wake Up before
// requestIdleCallback fires. Every transition is then exercised in story order
// on system Chrome / ANGLE D3D11. CPU submission, delivered rAF cadence, GPU
// timer queries, program growth, and render-target allocation are reported
// separately; no gl.finish() is used.
import { writeFileSync } from 'node:fs';
import {
  ensureServer, launchBrowser, openPage, URL_BASE, resultsPath,
} from '../tests/lib/harness.mjs';

const TRANSITIONS = [
  ['house->graveyard', 'graveyard'],
  ['graveyard->forest', 'forest'],
  ['forest->clearing', 'clearing'],
  ['clearing->cave', 'cave'],
  ['cave->mirror', 'mirror'],
];
const FRAME_COUNT = 18;

const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
const report = {
  url: `${URL_BASE}/?test=1&mute=1`,
  method: 'system Chrome / ANGLE D3D11; cold story-order transitions; no title warm-up; no gl.finish()',
  environment: null,
  initial: null,
  transitions: [],
  errors: [],
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, report.url);
  report.errors = errors;
  await page.waitForFunction(() => window.__FETCH?.ready && window.__game?.renderer,
    null, { timeout: 90000, polling: 100 });

  report.environment = await page.evaluate(() => {
    const g = window.__game;
    const gl = g.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      version: window.__FETCH.version,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      webgl: gl.getParameter(gl.VERSION),
      timerQuery: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
      compileAsync: typeof g.renderer.compileAsync === 'function',
      warmup: { ...g.shaderWarmup },
    };
  });

  await page.evaluate(() => window.__FETCH.start());
  report.initial = await page.evaluate(() => {
    const g = window.__game;
    g.teleport('house');
    window.__FETCH.step(1 / 120, 2, false);
    g.render();
    return {
      act: g.act,
      programs: g.renderer.info.programs?.length ?? null,
      geometries: g.renderer.info.memory.geometries,
      textures: g.renderer.info.memory.textures,
      warmup: { ...g.shaderWarmup },
    };
  });

  for (const [name, act] of TRANSITIONS) {
    const transition = await page.evaluate(async ({ name, act, frameCount }) => {
      const g = window.__game;
      const F = window.__FETCH;
      const gl = g.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const nextRaf = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const before = {
        act: g.act,
        programs: g.renderer.info.programs?.length ?? null,
        geometries: g.renderer.info.memory.geometries,
        textures: g.renderer.info.memory.textures,
      };

      if (act === 'cave' && !g.flags.has('waterfallTaken')) {
        g.director.waterfallTaken();
        g.skull.vanish();
      }
      if (act === 'mirror') g.el.fade.style.opacity = '1';

      const transitionAt = performance.now();
      F.teleport(act);
      const transitionMs = performance.now() - transitionAt;

      const stepAt = performance.now();
      F.step(1 / 120, act === 'mirror' ? 2 : 1, false);
      const firstStepMs = performance.now() - stepAt;

      const frames = [];
      const gpuPending = [];
      let previousRaf = null;
      for (let i = 0; i < frameCount; i++) {
        const rafAt = await nextRaf();
        const intervalMs = previousRaf == null ? null : rafAt - previousRaf;
        previousRaf = rafAt;
        const programsBefore = g.renderer.info.programs?.length ?? null;
        const texturesBefore = g.renderer.info.memory.textures;
        let query = null;
        if (ext) {
          query = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        }
        const renderAt = performance.now();
        g.render();
        const cpuMs = performance.now() - renderAt;
        if (query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          gl.flush();
          gpuPending.push({ index: i, query });
        }
        frames.push({
          index: i,
          intervalMs,
          cpuMs,
          programsBefore,
          programsAfter: g.renderer.info.programs?.length ?? null,
          texturesBefore,
          texturesAfter: g.renderer.info.memory.textures,
          drawCalls: g.lastRender.drawCalls,
          triangles: g.lastRender.triangles,
          gpuMs: null,
        });
      }

      const deadline = performance.now() + 8000;
      while (gpuPending.length && performance.now() < deadline) {
        await nextRaf();
        for (let i = gpuPending.length - 1; i >= 0; i--) {
          const pending = gpuPending[i];
          if (!gl.getQueryParameter(pending.query, gl.QUERY_RESULT_AVAILABLE)) continue;
          const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
          if (!disjoint) frames[pending.index].gpuMs = gl.getQueryParameter(pending.query, gl.QUERY_RESULT) / 1e6;
          gl.deleteQuery(pending.query);
          gpuPending.splice(i, 1);
        }
      }
      for (const pending of gpuPending) gl.deleteQuery(pending.query);

      return {
        name,
        before,
        after: {
          act: g.act,
          programs: g.renderer.info.programs?.length ?? null,
          geometries: g.renderer.info.memory.geometries,
          textures: g.renderer.info.memory.textures,
          finalePoolTextures: g.finale?.mirrors?.pool?.filter((target) =>
            !!g.renderer.properties.get(target.texture)?.__webglTexture).length ?? null,
        },
        transitionMs,
        firstStepMs,
        frames,
      };
    }, { name, act, frameCount: FRAME_COUNT });

    for (const frame of transition.frames) {
      for (const key of ['intervalMs', 'cpuMs', 'gpuMs']) frame[key] = round(frame[key]);
    }
    transition.transitionMs = round(transition.transitionMs);
    transition.firstStepMs = round(transition.firstStepMs);
    report.transitions.push(transition);
    const worstCpu = Math.max(...transition.frames.map((frame) => frame.cpuMs || 0));
    const worstInterval = Math.max(...transition.frames.map((frame) => frame.intervalMs || 0));
    const worstGpu = Math.max(...transition.frames.map((frame) => frame.gpuMs || 0));
    console.log(`${name}: transition ${transition.transitionMs}ms, step ${transition.firstStepMs}ms, `
      + `worst CPU ${worstCpu}ms, rAF ${worstInterval}ms, GPU ${worstGpu}ms, `
      + `programs ${transition.before.programs}->${transition.after.programs}, `
      + `textures ${transition.before.textures}->${transition.after.textures}`);
  }
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

writeFileSync(resultsPath('transition-profile.json'), JSON.stringify(report, null, 2));
if (report.errors.length) {
  console.error(report.errors.join('\n'));
  process.exitCode = 1;
}

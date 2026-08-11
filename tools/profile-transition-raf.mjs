// Delivered-frame companion to profile-transitions.mjs. This pass deliberately
// avoids GPU timer queries: query polling changes scheduling on this older GPU.
// FETCH's own rAF loop remains authoritative, with Game.render and Game.step
// wrapped only for wall-time/program-count observation.
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
const SAMPLE_RAFS = 90;
const PROFILE_WARMUP = process.env.FETCH_PROFILE_WARMUP === '1';
const PROFILE_RACE = process.env.FETCH_PROFILE_RACE === '1';
const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))] || 0;
};

const server = await ensureServer();
const browser = await launchBrowser();
const warmupEnabled = PROFILE_WARMUP || PROFILE_RACE;
const mode = PROFILE_RACE ? 'race' : PROFILE_WARMUP ? 'warm' : 'cold';
const report = {
  url: `${URL_BASE}/?test=1&mute=1${warmupEnabled ? '&warmup=1' : ''}${PROFILE_RACE ? '&warmupRace=1' : ''}`,
  mode,
  environment: null,
  transitions: [],
  errors: [],
};
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
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      compileAsync: typeof g.renderer.compileAsync === 'function',
      warmup: { ...g.shaderWarmup },
    };
  });
  if (PROFILE_WARMUP && !PROFILE_RACE) {
    await page.waitForFunction(() => !['scheduled', 'pending'].includes(window.__game.shaderWarmup.status),
      null, { timeout: 90000, polling: 100 });
  }
  await page.evaluate(() => {
    window.__FETCH.start();
    const g = window.__game;
    g._selfStep = true;
    g.teleport('house');
  });

  for (const [name, act] of TRANSITIONS) {
    const result = await page.evaluate(async ({ name, act, sampleRafs }) => {
      const g = window.__game;
      const F = window.__FETCH;
      const intervals = [];
      const renders = [];
      const steps = [];
      const oldRender = g.render;
      const oldStep = g.step;
      const programIds = new Set((g.renderer.info.programs || []).map((program) => program.id));
      const before = {
        act: g.act,
        programs: programIds.size,
        textures: g.renderer.info.memory.textures,
      };
      g.render = function profiledRender(...args) {
        const programsBefore = g.renderer.info.programs?.length ?? null;
        const texturesBefore = g.renderer.info.memory.textures;
        const at = performance.now();
        try { return oldRender.apply(this, args); }
        finally {
          renders.push({
            at,
            ms: performance.now() - at,
            programsBefore,
            programsAfter: g.renderer.info.programs?.length ?? null,
            texturesBefore,
            texturesAfter: g.renderer.info.memory.textures,
            calls: g.lastRender.drawCalls,
          });
        }
      };
      g.step = function profiledStep(...args) {
        const at = performance.now();
        try { return oldStep.apply(this, args); }
        finally { steps.push(performance.now() - at); }
      };

      if (act === 'cave' && !g.flags.has('waterfallTaken')) {
        g.director.waterfallTaken();
        // Debug teleport must reproduce the real waterfall directive: the
        // Underfalls district is skull-less, including its light cardinality.
        g.skull.vanish();
      }
      if (act === 'mirror') g.el.fade.style.opacity = '1';
      // Apply the act just after one delivered frame so the next game rAF is the
      // first frame that can submit its new district.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const transitionAt = performance.now();
      F.teleport(act);
      const transitionMs = performance.now() - transitionAt;
      let previous = null;
      await new Promise((resolve) => {
        const sample = (timestamp) => {
          if (previous != null) intervals.push(timestamp - previous);
          previous = timestamp;
          if (intervals.length >= sampleRafs) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      g.render = oldRender;
      g.step = oldStep;
      const newPrograms = (g.renderer.info.programs || [])
        .filter((program) => !programIds.has(program.id))
        .map((program) => ({
          id: program.id,
          name: program.name || '',
          cacheKey: `${program.cacheKey || ''}`.slice(0, 420),
        }));
      return {
        name,
        before,
        after: {
          act: g.act,
          programs: g.renderer.info.programs?.length ?? null,
          textures: g.renderer.info.memory.textures,
        },
        transitionMs,
        intervals,
        renders,
        steps,
        newPrograms,
      };
    }, { name, act, sampleRafs: SAMPLE_RAFS });
    result.transitionMs = round(result.transitionMs);
    result.intervals = result.intervals.map(round);
    result.renders.forEach((entry) => { entry.at = round(entry.at); entry.ms = round(entry.ms); });
    result.steps = result.steps.map(round);
    const summary = {
      worstRafMs: round(Math.max(...result.intervals)),
      p95RafMs: round(percentile(result.intervals, 0.95)),
      worstRenderCpuMs: round(Math.max(...result.renders.map((entry) => entry.ms))),
      worstStepMs: round(Math.max(...result.steps)),
      intervalsOver50Ms: result.intervals.filter((ms) => ms > 50).length,
      renderSubmissions: result.renders.length,
      fixedSteps: result.steps.length,
    };
    result.summary = summary;
    report.transitions.push(result);
    console.log(`${name}: rAF max/p95 ${summary.worstRafMs}/${summary.p95RafMs}ms, render CPU ${summary.worstRenderCpuMs}ms, `
      + `step ${summary.worstStepMs}ms, >50ms ${summary.intervalsOver50Ms}, programs `
      + `${result.before.programs}->${result.after.programs}, textures ${result.before.textures}->${result.after.textures}`);
  }
  report.finalWarmup = await page.evaluate(() => ({
    ...window.__game.shaderWarmup,
    targetWarm: window.__game.finale?._targetWarmState ? {
      status: window.__game.finale._targetWarmState.status,
      warmed: window.__game.finale._targetWarmState.warmed,
      maxSliceMs: window.__game.finale._targetWarmState.maxSliceMs,
    } : null,
  }));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
writeFileSync(resultsPath(`transition-raf-profile-${mode}.json`), JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
